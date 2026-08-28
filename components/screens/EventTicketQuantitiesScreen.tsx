import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { api } from '@/api';
import type { EventTicketTier } from '@/api/types';
import type { RootStackParamList, TicketSelectionItem } from '@/components/navigation/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/screens/ScreenHeader';
import { useTapToPayCollector } from '@/lib/stripe-terminal';

type Props = NativeStackScreenProps<RootStackParamList, 'EventTicketQuantities'>;

function isPayable(tier: EventTicketTier): boolean {
  return tier.type === 'paid' || tier.type === 'donation';
}

function priceLabel(tier: EventTicketTier): string {
  if (tier.type === 'donation') return 'Any amount';
  return tier.price ?? 'Free';
}

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Digits with at most one decimal point and two decimal places. */
function sanitizeAmount(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, 2);
  return `${cleaned.slice(0, dot)}.${fraction}`;
}

/** Best-effort parse of a formatted price label (e.g. "$50.00") for a display-only
 * running total — the backend computes the actual charge amount authoritatively. */
function parseMoney(label: string): number | null {
  const value = Number.parseFloat(label.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function totalLabelFor(items: TicketSelectionItem[]): string {
  const ticketCount = items
    .filter((item) => item.donationAmountCents == null)
    .reduce((sum, item) => sum + item.quantity, 0);
  const hasDonation = items.some((item) => item.donationAmountCents != null);

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

  const parts: string[] = [];
  if (ticketCount > 0) parts.push(`${ticketCount} ${ticketCount === 1 ? 'ticket' : 'tickets'}`);
  if (hasDonation) parts.push('donation');
  const label = parts.join(' + ') || 'nothing selected';

  const amount = `$${total.toFixed(2)}`;
  return hasUnknownPrice ? `${label} (${amount}+)` : `${label} · ${amount}`;
}

export function EventTicketQuantitiesScreen({ navigation, route }: Props) {
  const { eventId, eventTitle, memberId, memberName, autoCharge } = route.params;
  const insets = useSafeAreaInsets();
  const { data, error, isLoading } = useSWR('events', () => api.eventsList({ page_size: 50 }));
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [donationAmounts, setDonationAmounts] = useState<Record<string, string>>({});

  // The next screen collects a card — connect the reader now so that step
  // isn't waiting on a cold reader connection.
  const { prewarm } = useTapToPayCollector();
  useEffect(() => {
    prewarm();
  }, [prewarm]);

  const event = data?.data.find((item) => item.id === eventId);
  const tiers = (event?.ticket_tiers ?? []).filter(isPayable);

  function quantityFor(tierId: string): number {
    return quantities[tierId] ?? 0;
  }

  function donationCentsFor(tierId: string): number {
    const dollars = Number.parseFloat(donationAmounts[tierId] ?? '');
    if (!Number.isFinite(dollars) || dollars <= 0) return 0;
    return Math.round(dollars * 100);
  }

  function adjust(tier: EventTicketTier, delta: number) {
    setQuantities((prev) => {
      const current = prev[tier.id] ?? 0;
      const max = tier.available ?? Number.POSITIVE_INFINITY;
      const next = Math.max(0, Math.min(current + delta, max));
      return { ...prev, [tier.id]: next };
    });
  }

  const selectedItems: TicketSelectionItem[] = tiers.flatMap((tier) => {
    if (tier.type === 'donation') {
      const cents = donationCentsFor(tier.id);
      if (cents <= 0) return [];
      return [
        {
          ticketTierId: tier.id,
          name: tier.name,
          quantity: 1,
          unitPriceLabel: formatDollars(cents / 100),
          donationAmountCents: cents,
        },
      ];
    }
    const quantity = quantityFor(tier.id);
    if (quantity <= 0) return [];
    return [
      {
        ticketTierId: tier.id,
        name: tier.name,
        quantity,
        unitPriceLabel: priceLabel(tier),
      },
    ];
  });

  const hasSelection = selectedItems.length > 0;

  // Door-sale fast path: a member selected for an event with exactly one
  // fixed-price tier almost always means "one general-admission ticket,
  // charge them" — so skip this screen and go straight to card collection.
  // Guarded by a ref so pressing back from CollectPayment lands on this
  // picker rather than bouncing forward again. Donation tiers need an amount
  // typed in, so they never take this path.
  const autoChargedRef = useRef(false);
  useEffect(() => {
    if (autoChargedRef.current || !autoCharge || isLoading || !data) return;
    const found = data.data.find((item) => item.id === eventId);
    const payable = (found?.ticket_tiers ?? []).filter(isPayable);
    const only = payable.length === 1 ? payable[0] : undefined;
    if (!only || only.type !== 'paid') return;
    if (only.available !== null && only.available <= 0) return;

    autoChargedRef.current = true;
    const items: TicketSelectionItem[] = [
      { ticketTierId: only.id, name: only.name, quantity: 1, unitPriceLabel: priceLabel(only) },
    ];
    navigation.navigate('CollectPayment', {
      kind: 'ticket',
      memberId,
      memberName,
      eventId,
      eventTitle,
      items,
      totalLabel: totalLabelFor(items),
    });
  }, [autoCharge, isLoading, data, eventId, eventTitle, memberId, memberName, navigation]);

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
            const isDonation = item.type === 'donation';
            const rowTapAdds = !isDonation && !soldOut && !atMax;

            return (
              <Pressable
                className="mb-3 flex-row items-center rounded-xl border border-zinc-100 bg-white p-4"
                style={{ opacity: soldOut ? 0.5 : 1 }}
                // No `disabled` — that can swallow touches meant for the
                // stepper buttons inside. Omitting onPress is enough to make
                // the row inert when a tap shouldn't add one.
                onPress={rowTapAdds ? () => adjust(item, 1) : undefined}
                accessibilityLabel={rowTapAdds ? `Add one ${item.name}` : undefined}>
                <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                  <Ionicons
                    name={isDonation ? 'heart-outline' : 'ticket-outline'}
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

                {isDonation ? (
                  <View className="flex-row items-center rounded-lg border border-zinc-200 px-3">
                    <Text className="text-base text-zinc-500">$</Text>
                    <TextInput
                      className="ml-1 min-h-[44px] w-24 text-right text-lg font-semibold text-zinc-900"
                      placeholder="0"
                      placeholderTextColor="#d4d4d8"
                      keyboardType="decimal-pad"
                      value={donationAmounts[item.id] ?? ''}
                      onChangeText={(text) =>
                        setDonationAmounts((prev) => ({ ...prev, [item.id]: sanitizeAmount(text) }))
                      }
                      accessibilityLabel={`${item.name} amount in dollars`}
                    />
                  </View>
                ) : soldOut ? null : (
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
              </Pressable>
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
        <PrimaryButton
          className="w-full"
          disabled={!hasSelection}
          label={
            hasSelection
              ? `Continue — ${totalLabelFor(selectedItems)}`
              : 'Select at least one ticket'
          }
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
          }
        />
      </View>
    </View>
  );
}
