import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import useSWR from 'swr';

import { api } from '@/api';
import type { MembershipPlan } from '@/api/types';
import type { RootStackParamList } from '@/components/navigation/types';
import { ScreenHeader } from '@/components/screens/ScreenHeader';
import { useTapToPayCollector } from '@/lib/stripe-terminal';

type Props = NativeStackScreenProps<RootStackParamList, 'MembershipPlans'>;

function formatAmount(plan: MembershipPlan): string {
  // Unlike Stripe's own amounts (cents), `config :ysc, :membership_plans`
  // and this endpoint's JSON both store/return whole currency units, e.g.
  // `45` for $45 — see lib/ysc_web/controllers/api/app_memberships_json.ex.
  const amount = plan.amount.toLocaleString(undefined, {
    style: 'currency',
    currency: plan.currency.toUpperCase(),
  });
  return `${amount} / ${plan.interval}`;
}

export function MembershipPlansScreen({ navigation, route }: Props) {
  const { memberId, memberName, resumeTicket } = route.params;
  const { data, error, isLoading } = useSWR('membership-plans', () => api.membershipPlans());

  function goToCollectPayment(plan: MembershipPlan, startOffline: boolean) {
    navigation.navigate('CollectPayment', {
      kind: 'membership',
      memberId,
      memberName,
      planId: plan.id,
      planName: plan.name,
      amountLabel: formatAmount(plan),
      ...(resumeTicket ? { resumeTicket } : {}),
      ...(startOffline ? { startOffline: true } : {}),
    });
  }

  // The next screen collects a card — connect the reader now so that step
  // isn't waiting on a cold reader connection.
  const { prewarm } = useTapToPayCollector();
  useEffect(() => {
    prewarm();
  }, [prewarm]);

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader
        title="Choose a plan"
        subtitle={memberName}
        onBack={() => navigation.goBack()}
      />

      {error && (
        <View className="px-6 py-4">
          <Text className="text-sm text-rose-600">
            {error instanceof Error ? error.message : 'Failed to load plans'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="items-center py-12">
          <ActivityIndicator color="#144993" />
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            (data?.data.length ?? 0) > 0 ? (
              <Text className="mb-3 px-1 text-xs text-zinc-400">
                Tap a plan to take a card. Press and hold to record a cash or check payment.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mb-3 flex-row items-center rounded-xl border border-zinc-100 bg-white p-4 transition-transform duration-150 ease-in-out active:scale-[0.98]"
              onPress={() => goToCollectPayment(item, false)}
              onLongPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                goToCollectPayment(item, true);
              }}>
              <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                <Ionicons name="card-outline" size={20} color="#144993" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-zinc-900">{item.name}</Text>
                <Text className="mt-0.5 text-sm text-zinc-500">{item.description}</Text>
                <Text className="mt-1 text-sm font-medium text-blue-700">{formatAmount(item)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
