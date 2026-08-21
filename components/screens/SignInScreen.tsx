import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';

export function SignInScreen() {
  const { signIn, environment } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-1 text-center text-2xl font-semibold text-brand">YSC Admin</Text>
      <Text className="mb-8 text-center text-xs uppercase tracking-wide text-gray-400">
        {environment} environment
      </Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Email</Text>
      <TextInput
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3 text-base"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
        placeholder="you@ysc.org"
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Password</Text>
      <TextInput
        className="mb-2 rounded-lg border border-gray-300 px-4 py-3 text-base"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        editable={!submitting}
        placeholder="••••••••"
      />

      {error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}

      <TouchableOpacity
        className={`mt-4 items-center rounded-lg py-3 ${canSubmit ? 'bg-brand' : 'bg-gray-300'}`}
        onPress={handleSubmit}
        disabled={!canSubmit}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Sign in</Text>
        )}
      </TouchableOpacity>

      <View className="mt-8 gap-3">
        <TouchableOpacity
          className="items-center rounded-lg border border-gray-200 py-3 opacity-50"
          disabled>
          <Text className="text-base font-medium text-gray-500">Continue with Google (soon)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="items-center rounded-lg border border-gray-200 py-3 opacity-50"
          disabled>
          <Text className="text-base font-medium text-gray-500">Continue with Facebook (soon)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="items-center rounded-lg border border-gray-200 py-3 opacity-50"
          disabled>
          <Text className="text-base font-medium text-gray-500">Use a passkey (soon)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
