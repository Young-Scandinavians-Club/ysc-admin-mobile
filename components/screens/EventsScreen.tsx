import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import useSWR from 'swr';

import { api } from '@/api';
import type { Event } from '@/api/types';
import { useAuth } from '@/lib/auth-context';

function EventRow({ event }: { event: Event }) {
  return (
    <View className="mx-4 mb-3 rounded-xl border border-zinc-100 bg-white p-4">
      <Text className="text-base font-semibold text-zinc-900">{event.title}</Text>
      <Text className="mt-1 text-sm text-zinc-500">
        {event.pricing_info?.display_text ?? 'Pricing TBD'}
      </Text>
    </View>
  );
}

export function EventsScreen() {
  const { user, signOut } = useAuth();
  const { data, error, isLoading, isValidating, mutate } = useSWR('events', () =>
    api.eventsList({ page_size: 50 })
  );

  return (
    <View className="flex-1 bg-zinc-50">
      <View className="flex-row items-center justify-between border-b border-zinc-100 bg-white px-6 py-4">
        <View>
          <Text className="text-lg font-semibold text-blue-900">Upcoming events</Text>
          <Text className="text-xs text-zinc-500">
            Signed in as {user?.first_name} ({user?.role})
          </Text>
        </View>
        <TouchableOpacity className="min-h-[44px] justify-center" onPress={() => void signOut()}>
          <Text className="text-sm font-medium text-red-700">Sign out</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View className="px-6 py-4">
          <Text className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'Failed to load events'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-zinc-500">Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item, index) => item.id ?? String(index)}
          renderItem={({ item }) => <EventRow event={item} />}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
          refreshControl={
            <RefreshControl refreshing={isValidating} onRefresh={() => void mutate()} />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-zinc-500">No upcoming events</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
