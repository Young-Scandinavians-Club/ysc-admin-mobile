import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/components/navigation/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/screens/ScreenHeader';
import { isValidEmail } from '@/lib/ticketBuyer';

type Props = NativeStackScreenProps<RootStackParamList, 'GuestDetails'>;

/** Collects the only things a guest gives at checkout — name and email (the
 *  email is where the ticket link goes) — before picking public tiers. */
export function GuestDetailsScreen({ navigation, route }: Props) {
  const { eventId, eventTitle } = route.params;
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const emailInvalid = email.trim().length > 0 && !isValidEmail(email);
  const canContinue = firstName.trim().length > 0 && isValidEmail(email);

  function handleContinue() {
    if (!canContinue) return;
    navigation.navigate('EventTicketQuantities', {
      eventId,
      eventTitle,
      buyer: {
        kind: 'guest',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      },
    });
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-zinc-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Guest" subtitle={eventTitle} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled">
        <Text className="mb-4 text-sm text-zinc-500">
          Guests can buy public tickets only. Their tickets are emailed to the address below.
        </Text>

        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          autoComplete="given-name"
          autoFocus
        />
        <Field
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          autoComplete="family-name"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          error={emailInvalid ? 'Enter a valid email address' : undefined}
        />

        <PrimaryButton
          className="mt-4 w-full"
          label="Select tickets"
          disabled={!canContinue}
          onPress={handleContinue}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  error,
  ...inputProps
}: {
  label: string;
  error?: string | undefined;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-zinc-700">{label}</Text>
      <TextInput
        className="min-h-[48px] rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900"
        placeholderTextColor="#a1a1aa"
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-xs text-rose-600">{error}</Text> : null}
    </View>
  );
}
