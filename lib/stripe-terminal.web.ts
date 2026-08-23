export type CollectStep = 'idle' | 'connecting' | 'collecting' | 'processing' | 'success' | 'error';

export type CollectPaymentOutcome = { success: true } | { success: false; error: string };
export type CollectSetupOutcome =
  { success: true; paymentMethodId: string } | { success: false; error: string };

const UNSUPPORTED = 'Tap to Pay is only available in the native iOS/Android app.';

/**
 * Web stub — the Stripe Terminal SDK is native-only and even importing it
 * breaks Metro's web bundle, so this file (picked up automatically for web
 * builds instead of stripe-terminal.native.ts) never references the package.
 * It exists only so the web preview build (used for everything except actual
 * card collection) still compiles.
 */
export function useTapToPayCollector() {
  return {
    step: 'idle' as CollectStep,
    error: null as string | null,
    collectPayment: async (): Promise<CollectPaymentOutcome> => ({
      success: false,
      error: UNSUPPORTED,
    }),
    collectSetup: async (): Promise<CollectSetupOutcome> => ({
      success: false,
      error: UNSUPPORTED,
    }),
    reset: () => {},
  };
}
