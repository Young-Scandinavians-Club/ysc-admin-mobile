import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { api, ApiClientError } from '@/api';
import type { Member } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import type { RootStackParamList } from '@/components/navigation/types';
import { ScreenHeader } from '@/components/screens/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberSearch'>;

function memberName(member: Member): string {
  return [member.first_name, member.last_name].filter(Boolean).join(' ') || member.email;
}

export function MemberSearchScreen({ navigation, route }: Props) {
  const params = route.params;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const tooShort = trimmedQuery.length < 2;

  useEffect(() => {
    if (tooShort) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .searchMembers(trimmedQuery)
        .then((response) => {
          if (cancelled) return;
          setResults([...response.data]);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiClientError ? err.message : 'Search failed');
          setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, tooShort]);

  function selectMember(member: Member) {
    const name = memberName(member);
    if (params.purpose === 'membership') {
      if (member.has_active_membership) {
        navigation.navigate('MembershipDetails', { memberId: member.id, memberName: name });
      } else {
        navigation.navigate('MembershipPlans', { memberId: member.id, memberName: name });
      }
    } else {
      if (!member.has_active_membership) {
        Alert.alert(
          'No active membership',
          `${name} does not have an active membership. An active membership is required to purchase event tickets.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Set up membership',
              // Carry the event through the membership sign-up so that, once
              // it's done, the volunteer lands back on this ticket order
              // instead of at Home.
              onPress: () =>
                navigation.navigate('MembershipPlans', {
                  memberId: member.id,
                  memberName: name,
                  resumeTicket: { eventId: params.eventId, eventTitle: params.eventTitle },
                }),
            },
          ]
        );
        return;
      }

      navigation.navigate('EventTicketQuantities', {
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        memberId: member.id,
        memberName: name,
        autoCharge: true,
      });
    }
  }

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader
        title="Find member"
        subtitle={params.purpose === 'ticket' ? params.eventTitle : 'Membership'}
        onBack={() => navigation.goBack()}
      />

      <View className="px-4 pt-4">
        <View className="flex-row items-center rounded-xl border border-zinc-200 bg-white px-3">
          <Ionicons name="search" size={18} color="#a1a1aa" />
          <TextInput
            className="ml-2 min-h-[44px] flex-1 text-base text-zinc-900"
            placeholder="Search by name or email"
            placeholderTextColor="#a1a1aa"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            // Enter/"Search" on the keyboard picks the top result, so a
            // uniquely-named member is select-by-typing with no reach for the
            // list.
            onSubmitEditing={() => {
              const first = results[0];
              if (!tooShort && !loading && first) selectMember(first);
            }}
          />
        </View>
      </View>

      {error && (
        <View className="px-6 py-3">
          <Text className="text-sm text-rose-600">{error}</Text>
        </View>
      )}

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator color="#144993" />
        </View>
      ) : (
        <FlatList
          data={tooShort ? [] : results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mb-3 flex-row items-center rounded-xl border border-zinc-100 bg-white p-4 transition-transform duration-150 ease-in-out active:scale-[0.98]"
              onPress={() => selectMember(item)}>
              <View className="mr-4">
                <Avatar uri={item.avatar_url} size={44} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-zinc-900">{memberName(item)}</Text>
                <Text className="mt-0.5 text-sm text-zinc-500">{item.email}</Text>
              </View>
              {item.has_active_membership && (
                <View className="rounded-full bg-blue-50 px-2 py-1">
                  <Text className="text-xs font-medium text-blue-700">Member</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            tooShort ? (
              <View className="items-center py-12">
                <Text className="text-sm text-zinc-500">Type at least 2 characters to search</Text>
              </View>
            ) : (
              <View className="items-center py-12">
                <Text className="text-sm text-zinc-500">No members found</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}
