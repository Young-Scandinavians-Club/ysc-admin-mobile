import * as SecureStore from 'expo-secure-store';

import { type ApiEnvironment, isValidEnvironment } from '@/api/config';
import type { AppUser } from '@/api/types';

const KEY_TOKEN = 'ysc_admin_token';
const KEY_ENVIRONMENT = 'ysc_admin_environment';
const KEY_USER = 'ysc_admin_user';

export interface StoredSession {
  token: string;
  environment: ApiEnvironment;
  user: AppUser;
}

/** Load the signed-in session from secure storage. Returns null if not set or on error (e.g. web). */
export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const [token, environment, userJson] = await Promise.all([
      SecureStore.getItemAsync(KEY_TOKEN),
      SecureStore.getItemAsync(KEY_ENVIRONMENT),
      SecureStore.getItemAsync(KEY_USER),
    ]);
    if (!token || !environment || !userJson) return null;
    if (!isValidEnvironment(environment)) return null;

    const user = JSON.parse(userJson) as AppUser;
    return { token, environment, user };
  } catch {
    return null;
  }
}

/** Save the signed-in session to secure storage. */
export async function saveStoredSession(session: StoredSession): Promise<void> {
  try {
    await Promise.all([
      SecureStore.setItemAsync(KEY_TOKEN, session.token),
      SecureStore.setItemAsync(KEY_ENVIRONMENT, session.environment),
      SecureStore.setItemAsync(KEY_USER, JSON.stringify(session.user)),
    ]);
  } catch {
    // e.g. SecureStore not available on web
  }
}

/** Remove the stored session from secure storage (sign-out). */
export async function clearStoredSession(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_TOKEN),
      SecureStore.deleteItemAsync(KEY_ENVIRONMENT),
      SecureStore.deleteItemAsync(KEY_USER),
    ]);
  } catch {
    // no-op
  }
}
