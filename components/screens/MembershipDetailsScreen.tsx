import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, View } from 'react-native';
import useSWR from 'swr';

import { api } from '@/api';
import type { RootStackParamList } from '@/components/navigation/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/screens/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'MembershipDetails'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function MembershipDetailsScreen({ navigation, route }: Props) {
  const { memberId, memberName } = route.params;
  const { data, error, isLoading } = useSWR(['membership-status', memberId], () =>
    api.membershipStatus(memberId)
  );

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader title="Membership" subtitle={memberName} onBack={() => navigation.goBack()} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#144993" />
        </View>
      ) : error || !data?.has_active_membership ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-6 text-center text-sm text-zinc-500">
            {error instanceof Error
              ? error.message
              : "This member's active membership couldn't be confirmed. You can start a new sign-up instead."}
          </Text>
          <PrimaryButton
            label="Choose a plan"
            onPress={() => navigation.replace('MembershipPlans', { memberId, memberName })}
          />
        </View>
      ) : (
        <View className="flex-1 px-6 pt-6">
          <View className="items-center rounded-xl border border-zinc-100 bg-white p-6">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <Ionicons name="checkmark-circle" size={32} color="#15803d" />
            </View>
            <Text className="text-base font-semibold text-zinc-900">{data.plan_name}</Text>
            <Text className="mt-1 text-sm text-zinc-500">Already active — no payment needed</Text>

            <View className="mt-5 w-full border-t border-zinc-100 pt-5">
              {data.renewal_date ? (
                <View className="flex-row items-center justify-between py-1">
                  <Text className="text-sm text-zinc-500">
                    {data.cancel_at_period_end ? 'Ends' : 'Renews'}
                  </Text>
                  <Text className="text-sm font-medium text-zinc-900">
                    {formatDate(data.renewal_date)}
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center justify-between py-1">
                  <Text className="text-sm text-zinc-500">Expires</Text>
                  <Text className="text-sm font-medium text-zinc-900">Never</Text>
                </View>
              )}
              {data.cancel_at_period_end && (
                <Text className="mt-2 text-xs text-rose-600">
                  Scheduled to cancel — will not auto-renew
                </Text>
              )}
            </View>
          </View>

          <PrimaryButton
            label="Done"
            onPress={() => navigation.popToTop()}
            className="mt-6 w-full"
          />
        </View>
      )}
    </View>
  );
}
