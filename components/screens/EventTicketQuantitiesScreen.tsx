import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { api } from '@/api';
import type { EventTicketTier } from '@/api/types';
import type { RootStackParamList, TicketSelectionItem } from '@/components/navigation/types';
import { ScreenHeader } from '@/components/screens/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'EventTicketQuantities'>;

function isPayable(tier: EventTicketTier): boolean {
  return tier.type === 'paid' || tier.type === 'donation';
}

function priceLabel(tier: EventTicketTier): string {
  if (tier.type === 'donation') return 'Any amount';
  return tier.price ?? 'Free';
}

/** Best-effort parse of a formatted price label (e.g. "$50.00") for a display-only
 * running total — the backend computes the actual charge amount authoritatively. */
function parseMoney(label: string): number | null {
  const value = Number.parseFloat(label.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function totalLabelFor(items: TicketSelectionItem[]): string {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const ticketWord = totalCount === 1 ? 'ticket' : 'tickets';

  let total = 0;
  let hasUnknownPrice = false;
  for (const item of items) {
    const unit = parseMoney(item.unitPriceLabel);
    if (unit === null) {
      hasUnknownPrice = true;
    } else {
      total += unit * item.quantity;
    }
  }

  const amount = `$${total.toFixed(2)}`;
  return hasUnknownPrice
    ? `${totalCount} ${ticketWord} (${amount}+)`
    : `${totalCount} ${ticketWord} · ${amount}`;
}

export function EventTicketQuantitiesScreen({ navigation, route }: Props) {
  const { eventId, eventTitle, memberId, memberName } = route.params;
  const insets = useSafeAreaInsets();
  const { data, error, isLoading } = useSWR('events', () => api.eventsList({ page_size: 50 }));
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const event = data?.data.find((item) => item.id === eventId);
  const tiers = (event?.ticket_tiers ?? []).filter(isPayable);

  function quantityFor(tierId: string): number {
    return quantities[tierId] ?? 0;
  }

  function adjust(tier: EventTicketTier, delta: number) {
    setQuantities((prev) => {
      const current = prev[tier.id] ?? 0;
      const max = tier.available ?? Number.POSITIVE_INFINITY;
      const next = Math.max(0, Math.min(current + delta, max));
      return { ...prev, [tier.id]: next };
    });
  }

  const selectedItems: TicketSelectionItem[] = tiers
    .map((tier) => ({
      ticketTierId: tier.id,
      name: tier.name,
      quantity: quantityFor(tier.id),
      unitPriceLabel: priceLabel(tier),
    }))
    .filter((item) => item.quantity > 0);

  const totalCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader
        title="Select tickets"
        subtitle={eventTitle}
        onBack={() => navigation.goBack()}
      />

      {error && (
        <View className="px-6 py-4">
          <Text className="text-sm text-rose-600">
            {error instanceof Error ? error.message : 'Failed to load ticket tiers'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#144993" />
        </View>
      ) : (
        <FlatList
          data={tiers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => {
            const quantity = quantityFor(item.id);
            const soldOut = item.available !== null && item.available <= 0;
            const atMax = item.available !== null && quantity >= item.available;

            return (
              <View
                className="mb-3 flex-row items-center rounded-xl border border-zinc-100 bg-white p-4"
                style={{ opacity: soldOut ? 0.5 : 1 }}>
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
                    {soldOut ? 'Sold out' : priceLabel(item)}
                  </Text>
                </View>

                {!soldOut && (
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      className="h-16 w-16 items-center justify-center"
                      disabled={quantity === 0}
                      onPress={() => adjust(item, -1)}
                      accessibilityLabel={`Decrease ${item.name} quantity`}>
                      <Ionicons
                        name="remove-circle-outline"
                        size={44}
                        color={quantity === 0 ? '#d4d4d8' : '#144993'}
                      />
                    </TouchableOpacity>
                    <Text className="w-10 text-center text-xl font-semibold text-zinc-900">
                      {quantity}
                    </Text>
                    <TouchableOpacity
                      className="h-16 w-16 items-center justify-center"
                      disabled={atMax}
                      onPress={() => adjust(item, 1)}
                      accessibilityLabel={`Increase ${item.name} quantity`}>
                      <Ionicons
                        name="add-circle-outline"
                        size={44}
                        color={atMax ? '#d4d4d8' : '#144993'}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-zinc-500">No paid ticket tiers for this event</Text>
            </View>
          }
        />
      )}

      <View
        className="border-t border-zinc-100 bg-white px-6 py-4"
        style={{ paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          className="min-h-[44px] items-center justify-center rounded bg-blue-700 py-3 transition-transform duration-150 ease-in-out active:scale-[0.98]"
          style={{ opacity: totalCount === 0 ? 0.5 : 1 }}
          disabled={totalCount === 0}
          onPress={() =>
            navigation.navigate('CollectPayment', {
              kind: 'ticket',
              memberId,
              memberName,
              eventId,
              eventTitle,
              items: selectedItems,
              totalLabel: totalLabelFor(selectedItems),
            })
          }>
          <Text className="text-base font-semibold text-zinc-100">
            {totalCount === 0
              ? 'Select at least one ticket'
              : `Continue — ${totalLabelFor(selectedItems)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
