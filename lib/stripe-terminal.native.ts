import {
  requestNeededAndroidPermissions,
  useStripeTerminal,
} from '@stripe/stripe-terminal-react-native';
import { isDevice } from 'expo-device';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { api } from '@/api';

export type CollectStep = 'idle' | 'connecting' | 'collecting' | 'processing' | 'success' | 'error';

export type CollectPaymentOutcome = { success: true } | { success: false; error: string };
export type CollectSetupOutcome =
  { success: true; paymentMethodId: string } | { success: false; error: string };

/**
 * Shared Stripe Terminal Tap to Pay flow for both one-off ticket charges
 * (PaymentIntent) and membership card-on-file setup (SetupIntent). Both
 * share the same connect-a-reader step; only the retrieve/collect/confirm
 * calls differ, per the SDK's separate PaymentIntent/SetupIntent APIs.
 *
 * `simulated` mirrors Stripe's own convention: true in dev builds (no Apple
 * Tap to Pay entitlement / physical NFC hardware needed to exercise the
 * full flow against test-mode Stripe), false in production builds.
 */
const SIMULATED = __DEV__;

/**
 * Tap to Pay needs real NFC hardware just to discover a reader — Stripe's own
 * `simulated` flag doesn't bypass that, and neither the iOS Simulator nor the
 * Android emulator have NFC. In dev builds running on one of those (not a
 * real device), fall back to the `internet` discovery method instead (a
 * simulated WisePOS E reader) so the rest of this flow — connect, collect,
 * confirm — is still fully exercisable with zero hardware. On a real device
 * this stays `tapToPay` as normal. See
 * https://stripe-stripe-terminal-react-native.mintlify.app/guides/testing.
 */
const DISCOVERY_METHOD = __DEV__ && !isDevice ? 'internet' : 'tapToPay';

export function useTapToPayCollector() {
  const terminal = useStripeTerminal();
  const [step, setStep] = useState<CollectStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
  }, []);

  const ensureConnectedReader = useCallback(async () => {
    // Android requires an explicit runtime prompt for location (and, on 12+,
    // Bluetooth) permissions before Terminal can discover a reader — just
    // declaring them in app.json's manifest isn't enough. iOS handles this
    // itself via the Info.plist usage description the first time it's
    // needed, so this is a no-op there.
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
    if (!initialized.current) {
      const { error: initError } = await terminal.initialize();
      if (initError) throw new Error(initError.message);
      initialized.current = true;
    }

    const connectionStatus = await terminal.getConnectionStatus();
    if (connectionStatus === 'connected') return;

    const { location_id: locationId } = await api.createTerminalConnectionToken();

    const { error: connectError } =
      DISCOVERY_METHOD === 'internet'
        ? await terminal.easyConnect({
            discoveryMethod: 'internet',
            locationId,
            simulated: SIMULATED,
          })
        : await terminal.easyConnect({
            discoveryMethod: 'tapToPay',
            locationId,
            simulated: SIMULATED,
          });
    if (connectError) throw new Error(connectError.message);
  }, [terminal]);

  // Feeds a Stripe test card number to the simulated reader so a dev build
  // can complete "collection" without a real card/NFC tap — only meaningful
  // (and only ever called) when SIMULATED is true, i.e. dev builds.
  const applyTestCard = useCallback(
    async (testCardNumber: string | undefined) => {
      if (!__DEV__ || !testCardNumber) return;
      const { error: cardError } = await terminal.setSimulatedCard(testCardNumber);
      if (cardError) throw new Error(cardError.message);
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
        if (retrieved.error) throw new Error(retrieved.error.message);

        setStep('collecting');
        const collected = await terminal.collectPaymentMethod({
          paymentIntent: retrieved.paymentIntent,
        });
        if (collected.error) throw new Error(collected.error.message);

        setStep('processing');
        const confirmed = await terminal.confirmPaymentIntent({
          paymentIntent: collected.paymentIntent,
        });
        if (confirmed.error) throw new Error(confirmed.error.message);

        setStep('success');
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        setStep('error');
        setError(message);
        return { success: false, error: message };
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
        if (retrieved.error) throw new Error(retrieved.error.message);

        setStep('collecting');
        const collected = await terminal.collectSetupIntentPaymentMethod({
          setupIntent: retrieved.setupIntent,
        });
        if (collected.error) throw new Error(collected.error.message);

        setStep('processing');
        const confirmed = await terminal.confirmSetupIntent({
          setupIntent: collected.setupIntent,
        });
        if (confirmed.error) throw new Error(confirmed.error.message);

        const paymentMethodId = confirmed.setupIntent.paymentMethodId;
        if (!paymentMethodId) throw new Error('Card was not saved. Please try again.');

        setStep('success');
        return { success: true, paymentMethodId };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Card setup failed';
        setStep('error');
        setError(message);
        return { success: false, error: message };
      }
    },
    [terminal, ensureConnectedReader, applyTestCard]
  );

  return { step, error, collectPayment, collectSetup, reset };
}
