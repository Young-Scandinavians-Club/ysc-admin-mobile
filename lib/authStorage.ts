import * as SecureStore from 'expo-secure-store';

import { type ApiEnvironment, isValidEnvironment } from '@/api/config';
import type { AppUser } from '@/api/types';

const KEY_SESSION = 'ysc_admin_session';

export interface StoredSession {
  token: string;
  environment: ApiEnvironment;
  user: AppUser;
}

/** Load the signed-in session from secure storage. Returns null if not set or on error (e.g. web). */
export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const sessionJson = await SecureStore.getItemAsync(KEY_SESSION);
    if (!sessionJson) return null;

    const session = JSON.parse(sessionJson) as StoredSession;
    if (!session.token || !session.user || !isValidEnvironment(session.environment)) return null;

    return session;
  } catch {
    return null;
  }
}

/**
 * Save the signed-in session to secure storage as a single value — token,
 * environment, and user must always change together. Splitting them across
 * separate keys risked a partial write pairing a new token with a stale
 * user/environment (e.g. after a crash mid-write).
 */
export async function saveStoredSession(session: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_SESSION, JSON.stringify(session));
  } catch {
    // e.g. SecureStore not available on web
  }
}

/** Remove the stored session from secure storage (sign-out). */
export async function clearStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_SESSION);
  } catch {
    // no-op
  }
}
