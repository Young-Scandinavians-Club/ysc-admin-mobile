import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { api, ApiClientError } from '@/api';
import type { RootStackParamList } from '@/components/navigation/types';
import { ScreenHeader } from '@/components/screens/ScreenHeader';
import { useTapToPayCollector } from '@/lib/stripe-terminal';
import { DEFAULT_TEST_CARD, TEST_CARDS } from '@/lib/testCards';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectPayment'>;

type LocalPhase = 'preparing' | 'finalizing' | 'success' | 'error';

const PHASE_MESSAGE: Record<
  'preparing' | 'connecting' | 'collecting' | 'processing' | 'finalizing',
  string
> = {
  preparing: 'Preparing payment…',
  connecting: 'Connecting to reader…',
  collecting: 'Tap, insert, or swipe the card',
  processing: 'Processing payment…',
  finalizing: 'Saving membership…',
};

export function CollectPaymentScreen({ navigation, route }: Props) {
  const params = route.params;
  const collector = useTapToPayCollector();
  const [localPhase, setLocalPhase] = useState<LocalPhase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [testCardId, setTestCardId] = useState(DEFAULT_TEST_CARD.id);
  // Read via a ref (not a `run` dependency) so picking a different test card
  // never re-triggers the mount-time auto-run — it only applies on retry.
  const testCardIdRef = useRef(testCardId);
  useEffect(() => {
    testCardIdRef.current = testCardId;
  }, [testCardId]);

  const title = params.kind === 'ticket' ? params.eventTitle : params.planName;
  const amountLabel = params.kind === 'ticket' ? params.totalLabel : params.amountLabel;

  // While the terminal SDK is actively connecting/collecting/processing, its own
  // step takes precedence; otherwise we're between API calls (preparing the
  // intent, finalizing the membership subscription) or at a terminal state.
  const phase =
    localPhase === 'preparing' &&
    (collector.step === 'connecting' ||
      collector.step === 'collecting' ||
      collector.step === 'processing')
      ? collector.step
      : localPhase;

  const run = useCallback(async () => {
    const testCard = TEST_CARDS.find((c) => c.id === testCardIdRef.current) ?? DEFAULT_TEST_CARD;

    try {
      if (params.kind === 'ticket') {
        const tiers: Record<string, number> = {};
        for (const item of params.items) {
          tiers[item.ticketTierId] = item.quantity;
        }

        const intent = await api.createTicketPaymentIntent(params.eventId, {
          member_id: params.memberId,
          tiers,
        });

        const outcome = await collector.collectPayment(intent.client_secret, testCard.cardNumber);
        if (!outcome.success) throw new Error(outcome.error);
      } else {
        const setupIntent = await api.createMembershipSetupIntent({ member_id: params.memberId });

        const outcome = await collector.collectSetup(
          setupIntent.client_secret,
          testCard.cardNumber
        );
        if (!outcome.success) throw new Error(outcome.error);

        setLocalPhase('finalizing');
        await api.subscribeMembership({
          member_id: params.memberId,
          plan: params.planId,
          payment_method_id: outcome.paymentMethodId,
        });
      }
      setLocalPhase('success');
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Payment failed'
      );
      setLocalPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    const timer = setTimeout(() => void run(), 0);
    return () => clearTimeout(timer);
  }, [run]);

  function retry() {
    setError(null);
    setLocalPhase('preparing');
    void run();
  }

  // Door-sale flow: a ticket seller works one event at a time, charging one
  // person after another — so success sends them back to a fresh member
  // search for the *same* event instead of all the way to Home. Membership
  // sign-ups aren't repeated back-to-back the same way, so those still just
  // go Home.
  function handleDone() {
    if (params.kind === 'ticket') {
      navigation.popToTop();
      navigation.navigate('MemberSearch', {
        purpose: 'ticket',
        eventId: params.eventId,
        eventTitle: params.eventTitle,
      });
    } else {
      navigation.popToTop();
    }
  }

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader
        title={params.kind === 'ticket' ? 'Collect payment' : 'Collect membership'}
        subtitle={params.memberName}
        onBack={() => navigation.goBack()}
      />

      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 items-center">
          <Text className="text-base font-semibold text-zinc-900">{title}</Text>
          <Text className="mt-1 text-2xl font-bold text-blue-900">{amountLabel}</Text>
          {params.kind === 'ticket' && (
            <View className="mt-3 items-center">
              {params.items.map((item) => (
                <Text key={item.ticketTierId} className="text-sm text-zinc-500">
                  {item.quantity}× {item.name}
                </Text>
              ))}
            </View>
          )}
        </View>

        {__DEV__ && (
          <View className="mb-6 items-center">
            <Text className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
              Dev: test card (used on next attempt)
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {TEST_CARDS.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  className={`rounded-full border px-3 py-1.5 ${
                    testCardId === card.id
                      ? 'border-blue-700 bg-blue-700'
                      : 'border-zinc-200 bg-white'
                  }`}
                  onPress={() => setTestCardId(card.id)}>
                  <Text
                    className={`text-xs font-medium ${
                      testCardId === card.id ? 'text-zinc-100' : 'text-zinc-600'
                    }`}>
                    {card.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {phase === 'success' ? (
          <View className="items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <Ionicons name="checkmark" size={36} color="#15803d" />
            </View>
            <Text className="mb-6 text-base font-medium text-zinc-700">
              {params.kind === 'ticket' ? 'Payment successful' : 'Membership activated'}
            </Text>
            <TouchableOpacity
              className="min-h-[44px] items-center justify-center rounded bg-blue-700 px-8 py-3 transition-transform duration-150 ease-in-out active:scale-[0.98]"
              onPress={handleDone}>
              <Text className="text-base font-semibold text-zinc-100">
                {params.kind === 'ticket' ? 'Sell another ticket' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : phase === 'error' ? (
          <View className="items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-rose-50">
              <Ionicons name="close" size={36} color="#be123c" />
            </View>
            {error && <Text className="mb-6 text-center text-sm text-rose-600">{error}</Text>}
            <TouchableOpacity
              className="min-h-[44px] items-center justify-center rounded bg-blue-700 px-8 py-3 transition-transform duration-150 ease-in-out active:scale-[0.98]"
              onPress={retry}>
              <Text className="text-base font-semibold text-zinc-100">Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="items-center">
            <ActivityIndicator size="large" color="#144993" />
            <Text className="mt-4 text-sm text-zinc-500">{PHASE_MESSAGE[phase]}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
