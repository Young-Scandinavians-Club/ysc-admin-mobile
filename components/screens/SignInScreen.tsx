import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useMounted();
  const entrance = (delayClass: string) =>
    `transition-all duration-300 ease-out ${delayClass} ${mounted ? ENTRANCE_SHOWN : ENTRANCE_HIDDEN}`;

  async function handleSignIn() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 justify-center bg-white px-6 py-8">
      {/* Logo + heading — mirrors ysc.org's /users/log-in page (UserLoginLive):
          same logo mark, same "Sign in to your YSC account" heading style. */}
      <View className={`items-center py-8 ${entrance('')}`}>
        <Image
          source={require('@/assets/ysc_logo.png')}
          accessibilityLabel="Young Scandinavians Club logo"
          resizeMode="contain"
          style={{ width: 112, height: 112 }}
        />
        <Text className="mt-6 text-lg font-semibold text-zinc-800">
          Sign in to your YSC account
        </Text>
        <Text className="mt-1 text-xs uppercase tracking-wide text-zinc-400">
          Admin &amp; Volunteer App · {environment}
        </Text>
      </View>

      <View className={entrance('delay-100')}>
        <Text className="mb-6 text-center text-sm text-zinc-500">
          Sign in opens the YSC website in your browser — use whichever method you&apos;d normally
          use there (email, Google, or Facebook), then you&apos;ll be sent back here automatically.
        </Text>

        {error && <Text className="mb-4 text-center text-sm text-rose-600">{error}</Text>}

        <Pressable
          className="min-h-[44px] items-center justify-center rounded bg-blue-700 py-3 transition-transform duration-150 ease-in-out active:scale-[0.98]"
          style={{ opacity: submitting ? 0.8 : 1 }}
          onPress={handleSignIn}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-zinc-100">Sign in</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
