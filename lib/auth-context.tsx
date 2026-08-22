import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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

type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

/**
 * Must match the `scheme` in app.json and the exact string ysc.org's
 * `YscWeb.UserAuth.valid_mobile_redirect_uri?/1` allowlists.
 */
const MOBILE_REDIRECT_URI = 'ysc-admin://auth-callback';

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
    const loginUrl = `${config.baseUrl}/users/log-in?mobile_redirect_uri=${encodeURIComponent(
      MOBILE_REDIRECT_URI
    )}`;

    let result;
    try {
      result = await WebBrowser.openAuthSessionAsync(loginUrl, MOBILE_REDIRECT_URI);
    } catch {
      throw new Error('Unable to reach the server. Check your connection and try again.');
    }

    // User closed the browser tab without completing login — not an error.
    if (result.type !== 'success') return;

    const code = extractCodeParam(result.url);
    if (!code) {
      throw new Error('Sign-in did not complete. Please try again.');
    }

    let response;
    try {
      response = await exchangeCode(config, code);
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
    await clearStoredSession();
  }, []);

  const changeEnvironment = useCallback((env: ApiEnvironment) => {
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
