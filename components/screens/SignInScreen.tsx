import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';

/**
 * True after the first paint, so the entrance transition (below) has
 * something to animate to. Pure NativeWind (a CSS `transition-all` class
 * toggled by this flag) rather than an imperative animation library — see
 * README's "Design system" section on why this app avoids driving styles
 * from JS/Reanimated directly.
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}

const ENTRANCE_HIDDEN = 'opacity-0 translate-y-3';
const ENTRANCE_SHOWN = 'opacity-100 translate-y-0';

export function SignInScreen() {
  const { signIn, environment } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useMounted();
  const entrance = (delayClass: string) =>
    `transition-all duration-300 ease-out ${delayClass} ${mounted ? ENTRANCE_SHOWN : ENTRANCE_HIDDEN}`;

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
      <View className={entrance('')}>
        <Text className="mb-1 text-center text-2xl font-semibold text-blue-900">YSC Admin</Text>
        <Text className="mb-8 text-center text-xs uppercase tracking-wide text-zinc-400">
          {environment} environment
        </Text>
      </View>

      <View className={entrance('delay-100')}>
        <Text className="mb-1 text-sm font-medium text-zinc-700">Email</Text>
        <TextInput
          className="mb-4 min-h-[44px] rounded border border-zinc-300 px-4 py-3 text-base focus:border-blue-600"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
          placeholder="you@ysc.org"
        />

        <Text className="mb-1 text-sm font-medium text-zinc-700">Password</Text>
        <TextInput
          className="mb-2 min-h-[44px] rounded border border-zinc-300 px-4 py-3 text-base focus:border-blue-600"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
          placeholder="••••••••"
        />

        {error && <Text className="mb-2 text-sm text-rose-600">{error}</Text>}

        <Pressable
          className="mt-4 min-h-[44px] items-center justify-center rounded bg-blue-700 py-3 transition-transform duration-150 ease-in-out active:scale-[0.98] disabled:opacity-80"
          onPress={handleSubmit}
          disabled={!canSubmit}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-zinc-100">Sign in</Text>
          )}
        </Pressable>
      </View>

      <View className={`mt-8 gap-3 ${entrance('delay-200')}`}>
        <TouchableOpacity
          className="min-h-[44px] items-center justify-center rounded border border-zinc-200 py-3 opacity-50"
          disabled>
          <Text className="text-base font-medium text-zinc-500">Continue with Google (soon)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="min-h-[44px] items-center justify-center rounded border border-zinc-200 py-3 opacity-50"
          disabled>
          <Text className="text-base font-medium text-zinc-500">Continue with Facebook (soon)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="min-h-[44px] items-center justify-center rounded border border-zinc-200 py-3 opacity-50"
          disabled>
          <Text className="text-base font-medium text-zinc-500">Use a passkey (soon)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
