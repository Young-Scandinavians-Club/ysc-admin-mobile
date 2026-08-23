import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import useSWR from 'swr';

import { api } from '@/api';
import type { EventTicketTier } from '@/api/types';
import type { RootStackParamList } from '@/components/navigation/types';
import { ScreenHeader } from '@/components/screens/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'EventTicketTiers'>;

function isPayable(tier: EventTicketTier): boolean {
  return tier.type === 'paid' || tier.type === 'donation';
}

function priceLabel(tier: EventTicketTier): string {
  if (tier.type === 'donation') return 'Any amount';
  return tier.price ?? 'Free';
}

function soldOut(tier: EventTicketTier): boolean {
  return tier.available !== null && tier.available <= 0;
}

export function EventTicketTiersScreen({ navigation, route }: Props) {
  const { eventId, eventTitle } = route.params;
  const { data, error, isLoading } = useSWR('events', () => api.eventsList({ page_size: 50 }));

  const event = data?.data.find((item) => item.id === eventId);
  const tiers = (event?.ticket_tiers ?? []).filter(isPayable);

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader title="Ticket tiers" subtitle={eventTitle} onBack={() => navigation.goBack()} />

      {error && (
        <View className="px-6 py-4">
          <Text className="text-sm text-rose-600">
            {error instanceof Error ? error.message : 'Failed to load ticket tiers'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="items-center py-12">
          <ActivityIndicator color="#144993" />
        </View>
      ) : (
        <FlatList
          data={tiers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => {
            const disabled = soldOut(item);
            return (
              <TouchableOpacity
                className={`mb-3 flex-row items-center rounded-xl border border-zinc-100 bg-white p-4 transition-transform duration-150 ease-in-out active:scale-[0.98] ${
                  disabled ? 'opacity-50' : ''
                }`}
                disabled={disabled}
                onPress={() =>
                  navigation.navigate('MemberSearch', {
                    purpose: 'ticket',
                    eventId,
                    eventTitle,
                    ticketTierId: item.id,
                    ticketTierName: item.name,
                    priceLabel: priceLabel(item),
                  })
                }>
                <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                  <Ionicons
                    name={item.type === 'donation' ? 'heart-outline' : 'ticket-outline'}
                    size={20}
                    color="#144993"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-zinc-900">{item.name}</Text>
                  <Text className="mt-1 text-sm font-medium text-blue-700">
                    {disabled ? 'Sold out' : priceLabel(item)}
                  </Text>
                </View>
                {!disabled && <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-zinc-500">No paid ticket tiers for this event</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
