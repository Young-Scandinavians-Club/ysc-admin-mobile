import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
import { mutate as mutateGlobalCache } from 'swr';

import {
  ApiClientError,
  type ApiEnvironment,
  exchangeCode,
  getApiConfig,
  getEnvironment,
  setEnvironment,
  setToken,
} from '@/api';
import type { AppUser } from '@/api/types';
import { clearStoredSession, loadStoredSession, saveStoredSession } from '@/lib/authStorage';
import { isMobileRedirect, mobileRedirectUri } from '@/lib/mobileRedirect';
import { generatePkcePair } from '@/lib/pkce';

type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  environment: ApiEnvironment;
  /**
   * Opens the real ysc.org login page (password, Google, Facebook, and
   * eventually passkey — whatever it already supports) in a system browser
   * tab, and resolves once the app receives the post-login handoff. Returns
   * without error if the user simply closes the tab without signing in.
   */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Dev/preview builds only — lets a tester flip environments without a new build. */
  changeEnvironment: (env: ApiEnvironment) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * This app runs on shared devices passed between volunteers at an event, so
 * cached data (event lists, membership status) must not survive a sign-out —
 * the next person to sign in should never see a flash of the previous
 * person's session. `mutate` with a predicate key clears every SWR cache
 * entry regardless of key shape.
 */
function clearSwrCache() {
  void mutateGlobalCache(() => true, undefined, { revalidate: false });
}

/**
 * Set by `AuthProvider` while mounted so a 401 anywhere (e.g. from a SWR
 * fetch, not just the explicit signIn/exchangeCode calls below) can force a
 * sign-out back to the login screen — see `lib/swr.ts`'s `onError`.
 */
let globalSignOut: (() => void) | null = null;

export function triggerGlobalSignOut(): void {
  globalSignOut?.();
}

function extractCodeParam(url: string): string | null {
  const match = url.match(/[?&]code=([^&]+)/);
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [environment, setEnvironmentState] = useState<ApiEnvironment>(getEnvironment());

  useEffect(() => {
    let cancelled = false;

    loadStoredSession().then((stored) => {
      if (cancelled) return;
      if (stored) {
        setEnvironment(stored.environment);
        setToken(stored.token);
        setEnvironmentState(stored.environment);
        setUser(stored.user);
        setStatus('signed_in');
      } else {
        setStatus('signed_out');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const config = getApiConfig();
    const { codeVerifier, codeChallenge } = await generatePkcePair();
    // Android + https backend → an App Link (`https://<host>/app/auth-callback`),
    // which opens the app on a tap and degrades to a web page when it isn't
    // installed. iOS (no Universal Links set up) and http/local dev → the
    // `ysc-admin://` custom scheme.
    const redirectUri = mobileRedirectUri(config.baseUrl, Platform.OS);
    const loginUrl =
      `${config.baseUrl}/users/log-in` +
      `?mobile_redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code_challenge=${codeChallenge}`;

    // On some Android/Chrome combinations, openAuthSessionAsync's own promise
    // never resolves even though the OS *did* hand the redirect back to this
    // app (a documented Custom Tabs flakiness — see
    // https://github.com/expo/expo/issues/27500). Racing a plain Linking
    // listener alongside it catches that case: whichever fires first wins,
    // and we dismiss the lingering browser tab ourselves either way.
    let redirectUrl: string | null;
    try {
      redirectUrl = await new Promise<string | null>((resolve, reject) => {
        let settled = false;

        const subscription = Linking.addEventListener('url', ({ url }) => {
          if (settled || !isMobileRedirect(url, redirectUri)) return;
          settled = true;
          subscription.remove();
          void WebBrowser.dismissBrowser();
          resolve(url);
        });

        WebBrowser.openAuthSessionAsync(loginUrl, redirectUri)
          .then((result) => {
            if (settled) return;
            settled = true;
            subscription.remove();
            resolve(result.type === 'success' ? result.url : null);
          })
          .catch((err: unknown) => {
            if (settled) return;
            settled = true;
            subscription.remove();
            reject(err);
          });
      });
    } catch {
      throw new Error('Unable to reach the server. Check your connection and try again.');
    }

    // User closed the browser tab without completing login — not an error.
    if (!redirectUrl) return;

    const code = extractCodeParam(redirectUrl);
    if (!code) {
      throw new Error('Sign-in did not complete. Please try again.');
    }

    let response;
    try {
      response = await exchangeCode(config, code, codeVerifier);
    } catch (err) {
      if (err instanceof ApiClientError) throw err;
      throw new Error('Unable to reach the server. Check your connection and try again.');
    }

    setToken(response.token);
    setUser(response.user);
    setStatus('signed_in');
    await saveStoredSession({
      token: response.token,
      environment: getEnvironment(),
      user: response.user,
    });
  }, []);

  const signOutFn = useCallback(async () => {
    setToken(null);
    setUser(null);
    setStatus('signed_out');
    clearSwrCache();
    await clearStoredSession();
  }, []);

  useEffect(() => {
    globalSignOut = () => void signOutFn();
    return () => {
      globalSignOut = null;
    };
  }, [signOutFn]);

  const changeEnvironment = useCallback((env: ApiEnvironment) => {
    // A token/user is only ever valid for the environment it was issued
    // against — switching backends while "signed in" would otherwise send
    // an old bearer token to a different server and mix cached data
    // between environments on this shared device.
    setToken(null);
    setUser(null);
    setStatus('signed_out');
    clearSwrCache();
    void clearStoredSession();
    setEnvironment(env);
    setEnvironmentState(env);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, environment, signIn, signOut: signOutFn, changeEnvironment }),
    [status, user, environment, signIn, signOutFn, changeEnvironment]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
