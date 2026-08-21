import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ApiClientError,
  type ApiEnvironment,
  getApiConfig,
  getEnvironment,
  setEnvironment,
  setToken,
  signInWithPassword,
} from '@/api';
import type { AppUser } from '@/api/types';
import { clearStoredSession, loadStoredSession, saveStoredSession } from '@/lib/authStorage';

type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  environment: ApiEnvironment;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Dev/preview builds only — lets a tester flip environments without a new build. */
  changeEnvironment: (env: ApiEnvironment) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const signIn = useCallback(async (email: string, password: string) => {
    const config = getApiConfig();
    let response;
    try {
      response = await signInWithPassword(config, email, password);
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
