import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import { useCallback, useRef, useState } from 'react';

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
    const connectionStatus = await terminal.getConnectionStatus();
    if (connectionStatus === 'connected') return;

    if (!initialized.current) {
      const { error: initError } = await terminal.initialize();
      if (initError) throw new Error(initError.message);
      initialized.current = true;
    }

    const { location_id: locationId } = await api.createTerminalConnectionToken();

    const { error: connectError } = await terminal.easyConnect({
      discoveryMethod: 'tapToPay',
      locationId,
      simulated: SIMULATED,
    });
    if (connectError) throw new Error(connectError.message);
  }, [terminal]);

  const collectPayment = useCallback(
    async (clientSecret: string): Promise<CollectPaymentOutcome> => {
      setError(null);
      try {
        setStep('connecting');
        await ensureConnectedReader();

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
    [terminal, ensureConnectedReader]
  );

  const collectSetup = useCallback(
    async (clientSecret: string): Promise<CollectSetupOutcome> => {
      setError(null);
      try {
        setStep('connecting');
        await ensureConnectedReader();

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
    [terminal, ensureConnectedReader]
  );

  return { step, error, collectPayment, collectSetup, reset };
}
