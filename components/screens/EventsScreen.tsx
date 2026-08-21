import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import useSWR from 'swr';

import { api } from '@/api';
import type { Event } from '@/api/types';
import { useAuth } from '@/lib/auth-context';

function EventRow({ event }: { event: Event }) {
  return (
    <View className="border-b border-gray-100 px-6 py-4">
      <Text className="text-base font-semibold text-gray-900">{event.title}</Text>
      <Text className="mt-1 text-sm text-gray-500">
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
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-gray-100 px-6 py-4">
        <View>
          <Text className="text-lg font-semibold text-brand">Upcoming events</Text>
          <Text className="text-xs text-gray-400">
            Signed in as {user?.first_name} ({user?.role})
          </Text>
        </View>
        <TouchableOpacity onPress={() => void signOut()}>
          <Text className="text-sm font-medium text-red-600">Sign out</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View className="px-6 py-4">
          <Text className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load events'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-gray-400">Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item, index) => item.id ?? String(index)}
          renderItem={({ item }) => <EventRow event={item} />}
          refreshControl={
            <RefreshControl refreshing={isValidating} onRefresh={() => void mutate()} />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-sm text-gray-400">No upcoming events</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
