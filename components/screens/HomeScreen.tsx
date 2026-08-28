import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useSWR from 'swr';

import { api } from '@/api';
import type { Event } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import type { RootStackParamList } from '@/components/navigation/types';
import { useAuth } from '@/lib/auth-context';
import { useEventMode } from '@/lib/event-mode-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function ActionButton({
  icon,
  label,
  subtitle,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      className="min-h-[44px] flex-row items-center rounded-xl border border-zinc-100 bg-white p-4 transition-transform duration-150 ease-in-out active:scale-[0.98]"
      style={{ opacity: disabled ? 0.5 : 1 }}
      onPress={onPress}
      disabled={disabled}>
      <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-blue-50">
        <Ionicons name={icon} size={22} color="#144993" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-zinc-900">{label}</Text>
        <Text className="mt-0.5 text-xs text-zinc-500">{subtitle}</Text>
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />}
    </Pressable>
  );
}

function EventRow({
  event,
  onPress,
  pinned = false,
  onTogglePin,
}: {
  event: Event;
  onPress?: (() => void) | undefined;
  pinned?: boolean;
  onTogglePin?: (() => void) | undefined;
}) {
  return (
    <TouchableOpacity
      className="mb-3 flex-row items-center rounded-xl border border-zinc-100 bg-white p-4 transition-transform duration-150 ease-in-out active:scale-[0.98]"
      style={{ opacity: onPress ? 1 : 0.5 }}
      disabled={!onPress}
      onPress={onPress}>
      <View className="mr-4 h-11 w-11 items-center justify-center rounded-full bg-blue-50">
        <Ionicons name="calendar-outline" size={20} color="#144993" />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-zinc-900">{event.title}</Text>
        <Text className="mt-1 text-sm text-zinc-500">
          {event.pricing_info?.display_text ?? 'Pricing TBD'}
        </Text>
      </View>
      {onTogglePin && (
        <TouchableOpacity
          className="h-11 w-11 items-center justify-center"
          onPress={onTogglePin}
          accessibilityLabel={
            pinned ? `Exit event mode for ${event.title}` : `Take payments for ${event.title}`
          }>
          <Ionicons
            name={pinned ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={pinned ? '#144993' : '#a1a1aa'}
          />
        </TouchableOpacity>
      )}
      <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
    </TouchableOpacity>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { pinnedEvent, pinEvent, unpinEvent } = useEventMode();
  const insets = useSafeAreaInsets();
  const { data, error, isLoading, isValidating, mutate } = useSWR('events', () =>
    api.eventsList({ page_size: 50 })
  );

  // "Event mode": when an event is pinned, the app opens straight into member
  // search for it instead of this list. Runs once per mount — pressing back to
  // Home (which stays mounted underneath) then shows the list normally, so the
  // volunteer can change or exit event mode.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectedRef.current || !pinnedEvent) return;
    redirectedRef.current = true;
    navigation.navigate('MemberSearch', {
      purpose: 'ticket',
      eventId: pinnedEvent.id,
      eventTitle: pinnedEvent.title,
    });
  }, [pinnedEvent, navigation]);

  return (
    <View className="flex-1 bg-zinc-50">
      <View
        className="flex-row items-center justify-between border-b border-zinc-100 bg-white px-6 py-4"
        style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center">
          {user && <Avatar uri={user.avatar_url} size={36} />}
          <View className="ml-3">
            <Text className="text-lg font-semibold text-blue-900">Take a payment</Text>
            <Text className="text-xs text-zinc-500">
              Signed in as {user?.first_name} ({user?.role})
            </Text>
          </View>
        </View>
        <TouchableOpacity className="min-h-[44px] justify-center" onPress={() => void signOut()}>
          <Text className="text-sm font-medium text-red-700">Sign out</Text>
        </TouchableOpacity>
      </View>

      {pinnedEvent && (
        <View className="flex-row items-center justify-between border-b border-blue-100 bg-blue-50 px-6 py-3">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Event mode
            </Text>
            <Text className="text-sm font-medium text-blue-900" numberOfLines={1}>
              {pinnedEvent.title}
            </Text>
          </View>
          <TouchableOpacity className="min-h-[44px] justify-center" onPress={unpinEvent}>
            <Text className="text-sm font-medium text-blue-700">Change</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View className="px-6 py-4">
          <Text className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'Failed to load events'}
          </Text>
        </View>
      )}

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item, index) => item.id ?? String(index)}
        renderItem={({ item }) => {
          // item.id can be missing on malformed data — silently building an
          // empty eventId would navigate into a dead-end "no ticket tiers"
          // screen instead of clearly doing nothing.
          const eventId = item.id;
          return (
            <EventRow
              event={item}
              pinned={pinnedEvent?.id === eventId}
              onPress={
                eventId
                  ? () =>
                      navigation.navigate('MemberSearch', {
                        purpose: 'ticket',
                        eventId,
                        eventTitle: item.title,
                      })
                  : undefined
              }
              onTogglePin={
                eventId
                  ? () => {
                      if (pinnedEvent?.id === eventId) {
                        unpinEvent();
                        return;
                      }
                      pinEvent({ id: eventId, title: item.title });
                      redirectedRef.current = true;
                      navigation.navigate('MemberSearch', {
                        purpose: 'ticket',
                        eventId,
                        eventTitle: item.title,
                      });
                    }
                  : undefined
              }
            />
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl refreshing={isValidating} onRefresh={() => void mutate()} />
        }
        ListHeaderComponent={
          <View className="mb-5">
            <View className="mb-3">
              <ActionButton
                icon="card-outline"
                label="Membership"
                subtitle="Tap to pay for a new or renewed membership"
                onPress={() => navigation.navigate('MemberSearch', { purpose: 'membership' })}
              />
            </View>
            <ActionButton icon="heart-outline" label="Donation" subtitle="Coming soon" disabled />
            <View className="my-5 h-px bg-zinc-200" />
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Upcoming events
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center py-12">
              <Text className="text-sm text-zinc-500">Loading…</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-sm text-zinc-500">No upcoming events with paid tickets</Text>
            </View>
          )
        }
      />
    </View>
  );
}
