export interface TestCardOption {
  id: string;
  label: string;
  cardNumber: string;
}

const SUCCESS_CARD: TestCardOption = {
  id: 'success',
  label: 'Visa · succeeds',
  cardNumber: '4242424242424242',
};

/**
 * Stripe Terminal simulated-reader test cards for dev builds — feeding one of
 * these to `setSimulatedCard` completes the "tap" step in software, so you
 * can exercise success/decline/3DS paths without a real card or NFC tap. See
 * https://stripe-stripe-terminal-react-native.mintlify.app/guides/testing.
 */
export const TEST_CARDS: readonly TestCardOption[] = [
  SUCCESS_CARD,
  { id: 'decline', label: 'Declined', cardNumber: '4000000000000002' },
  { id: 'insufficient_funds', label: 'Insufficient funds', cardNumber: '4000000000009995' },
  { id: 'requires_3ds', label: 'Requires authentication', cardNumber: '4000002500003155' },
];

export const DEFAULT_TEST_CARD: TestCardOption = SUCCESS_CARD;
