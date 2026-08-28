import {
  requestNeededAndroidPermissions,
  useStripeTerminal,
} from '@stripe/stripe-terminal-react-native';
import { isDevice } from 'expo-device';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { api, getEnvironment } from '@/api';

export type CollectStep = 'idle' | 'connecting' | 'collecting' | 'processing' | 'success' | 'error';

export type CollectPaymentOutcome =
  { success: true } | { success: false; error: string; code?: string };
export type CollectSetupOutcome =
  { success: true; paymentMethodId: string } | { success: false; error: string; code?: string };

/**
 * Shared Stripe Terminal Tap to Pay flow for both one-off ticket charges
 * (PaymentIntent) and membership card-on-file setup (SetupIntent). Both
 * share the same connect-a-reader step; only the retrieve/collect/confirm
 * calls differ, per the SDK's separate PaymentIntent/SetupIntent APIs.
 */

/**
 * Whether to connect a *simulated* reader instead of real Tap to Pay
 * hardware. Simulated for every backend except production:
 *
 *  - Stripe's production Tap to Pay reader refuses to initialise on an
 *    Android device with Developer Options enabled ("Developer Options must
 *    not be enabled when using the production version of the Tap to Pay
 *    reader"). Sandbox testing happens on developers' own phones, which
 *    routinely have that on, so a non-prod build must never reach for the
 *    real reader.
 *  - Against test-mode Stripe a simulated reader is the intended setup
 *    anyway: it exercises connect / collect / confirm end to end with no
 *    NFC hardware or Apple Tap to Pay entitlement.
 *
 * Read at connect time, not module load — the in-app environment switcher
 * (see lib/auth-context.tsx) can move between sandbox and prod at runtime.
 */
function isSimulatedReader(): boolean {
  return getEnvironment() !== 'prod';
}

/**
 * Tap to Pay needs real NFC hardware just to discover a reader — Stripe's own
 * `simulated` flag doesn't bypass that, and neither the iOS Simulator nor the
 * Android emulator have NFC. When using a simulated reader on one of those
 * (not a real device), fall back to the `internet` discovery method instead
 * (a simulated WisePOS E reader) so the rest of this flow — connect, collect,
 * confirm — is still fully exercisable with zero hardware. On a real device
 * this stays `tapToPay` as normal. See
 * https://stripe-stripe-terminal-react-native.mintlify.app/guides/testing.
 */
function discoveryMethod(): 'internet' | 'tapToPay' {
  return isSimulatedReader() && !isDevice ? 'internet' : 'tapToPay';
}

/**
 * `initialize()` is a process-wide, once-only SDK call — the reader connection
 * it sets up is a singleton. Tracked at module scope (not per-hook) so a
 * `prewarm()` from one screen and a `collectPayment()` from another don't each
 * try to initialize; the second caller sees this already set and skips it.
 */
let terminalInitialized = false;

/**
 * A connect attempt already running, shared by every concurrent caller so the
 * `prewarm()` on entering a payment flow and the real `collectPayment()` that
 * follows don't fire two overlapping discovery/connect sequences at the SDK.
 * Cleared when it settles so a later attempt can retry after a failure.
 */
let connectInFlight: Promise<void> | null = null;

type Terminal = ReturnType<typeof useStripeTerminal>;

async function connectReader(terminal: Terminal): Promise<void> {
  // Android requires an explicit runtime prompt for location (and, on 12+,
  // Bluetooth) permissions before Terminal can discover a reader — just
  // declaring them in app.json's manifest isn't enough. iOS handles this
  // itself via the Info.plist usage description the first time it's needed,
  // so this is a no-op there.
  if (Platform.OS === 'android') {
    const { error: permissionError } = await requestNeededAndroidPermissions();
    if (permissionError) {
      throw new Error(
        'Location permission is required to connect a card reader. Please grant it in Settings.'
      );
    }
  }

  // The SDK requires initialize() before any other method — including
  // getConnectionStatus() — so this must run first, not just before connect.
  if (!terminalInitialized) {
    const { error: initError } = await terminal.initialize();
    if (initError) throw toTerminalError(initError);
    terminalInitialized = true;
  }

  const connectionStatus = await terminal.getConnectionStatus();
  if (connectionStatus === 'connected') return;

  const { location_id: locationId } = await api.createTerminalConnectionToken();

  const simulated = isSimulatedReader();
  const { error: connectError } =
    discoveryMethod() === 'internet'
      ? await terminal.easyConnect({ discoveryMethod: 'internet', locationId, simulated })
      : await terminal.easyConnect({ discoveryMethod: 'tapToPay', locationId, simulated });
  if (connectError) throw toTerminalError(connectError);
}

/** Preserve a Stripe error's `.code` on the thrown Error so callers can tell a
 *  card decline (`DeclinedByStripeAPI` / `DeclinedByReader`) apart from a
 *  reader/network problem. */
function toTerminalError(e: { code?: string; message: string }): Error {
  const err = new Error(e.message) as Error & { code?: string };
  if (e.code) err.code = e.code;
  return err;
}

function errorCode(err: unknown): string | undefined {
  return err && typeof err === 'object' && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

/** Build a failure outcome, omitting `code` entirely when there isn't one
 *  (rather than setting it to `undefined`, which exactOptionalPropertyTypes
 *  rejects). */
function failure(message: string, err: unknown): { success: false; error: string; code?: string } {
  const code = errorCode(err);
  return code === undefined
    ? { success: false, error: message }
    : { success: false, error: message, code };
}

export function useTapToPayCollector() {
  const terminal = useStripeTerminal();
  const [step, setStep] = useState<CollectStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
  }, []);

  const ensureConnectedReader = useCallback(async () => {
    connectInFlight ??= connectReader(terminal);
    try {
      await connectInFlight;
    } finally {
      connectInFlight = null;
    }
  }, [terminal]);

  /**
   * Best-effort: connect the reader ahead of time (on entering a payment
   * flow) so the first real charge doesn't pay the initialize + discover +
   * connect cost on the critical path. Errors here are swallowed — they'll
   * resurface with proper handling when `collectPayment`/`collectSetup`
   * actually runs.
   */
  const prewarm = useCallback(() => {
    void ensureConnectedReader().catch(() => {});
  }, [ensureConnectedReader]);

  // Feeds a Stripe test card number to the simulated reader so a non-prod
  // build can complete "collection" without a real card/NFC tap — only
  // meaningful when connected to a simulated reader (test-mode Stripe).
  const applyTestCard = useCallback(
    async (testCardNumber: string | undefined) => {
      if (!isSimulatedReader() || !testCardNumber) return;
      const { error: cardError } = await terminal.setSimulatedCard(testCardNumber);
      if (cardError) throw toTerminalError(cardError);
    },
    [terminal]
  );

  const collectPayment = useCallback(
    async (clientSecret: string, testCardNumber?: string): Promise<CollectPaymentOutcome> => {
      setError(null);
      try {
        setStep('connecting');
        await ensureConnectedReader();
        await applyTestCard(testCardNumber);

        const retrieved = await terminal.retrievePaymentIntent(clientSecret);
        if (retrieved.error) throw toTerminalError(retrieved.error);

        setStep('collecting');
        const collected = await terminal.collectPaymentMethod({
          paymentIntent: retrieved.paymentIntent,
        });
        if (collected.error) throw toTerminalError(collected.error);

        setStep('processing');
        const confirmed = await terminal.confirmPaymentIntent({
          paymentIntent: collected.paymentIntent,
        });
        if (confirmed.error) throw toTerminalError(confirmed.error);

        setStep('success');
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        setStep('error');
        setError(message);
        return failure(message, err);
      }
    },
    [terminal, ensureConnectedReader, applyTestCard]
  );

  const collectSetup = useCallback(
    async (clientSecret: string, testCardNumber?: string): Promise<CollectSetupOutcome> => {
      setError(null);
      try {
        setStep('connecting');
        await ensureConnectedReader();
        await applyTestCard(testCardNumber);

        const retrieved = await terminal.retrieveSetupIntent(clientSecret);
        if (retrieved.error) throw toTerminalError(retrieved.error);

        setStep('collecting');
        const collected = await terminal.collectSetupIntentPaymentMethod({
          setupIntent: retrieved.setupIntent,
          // Required by Stripe/card-network rules for saving a card via
          // Terminal. "limited" (not "always") because this card is being
          // saved specifically to bill this membership's renewals, not as a
          // general saved card the member would see in a checkout flow
          // elsewhere — matches Stripe's own default for subscription-mode
          // saves. See https://docs.stripe.com/terminal/features/saving-payment-details/save-directly
          allowRedisplay: 'limited',
          collectionReason: 'saveCard',
        });
        if (collected.error) throw toTerminalError(collected.error);

        setStep('processing');
        const confirmed = await terminal.confirmSetupIntent({
          setupIntent: collected.setupIntent,
        });
        if (confirmed.error) throw toTerminalError(confirmed.error);

        // For a card_present SetupIntent, `setupIntent.paymentMethodId` is the
        // original, single-use card-present PaymentMethod — Stripe attaches a
        // *different*, reusable PaymentMethod (the "generated card") to the
        // customer instead, exposed here via latestAttempt. Using the former
        // (rather than this one) as the subscription's default_payment_method
        // fails, since it was never attached to the customer. See
        // https://docs.stripe.com/api/setup_intents/object#setup_intent_object-payment_method
        const paymentMethodId =
          confirmed.setupIntent.latestAttempt?.paymentMethodDetails?.cardPresent?.generatedCard ??
          confirmed.setupIntent.paymentMethodId;
        if (!paymentMethodId) throw new Error('Card was not saved. Please try again.');

        setStep('success');
        return { success: true, paymentMethodId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Card setup failed';
        setStep('error');
        setError(message);
        return failure(message, err);
      }
    },
    [terminal, ensureConnectedReader, applyTestCard]
  );

  return { step, error, collectPayment, collectSetup, prewarm, reset };
}
