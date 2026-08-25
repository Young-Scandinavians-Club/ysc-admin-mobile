import { Platform } from 'react-native';

/** Named API environments with fixed base URLs — same three the backend deploys to. */
export const API_BASE_URLS = {
  /** Local dev: localhost (iOS Simulator) or 10.0.2.2 (Android emulator). Default. */
  local: 'http://localhost:4000',
  /** Sandbox: https://ysc-sandbox.fly.dev — Stripe in test mode. */
  sandbox: 'https://ysc-sandbox.fly.dev',
  /** Production: https://ysc.org */
  prod: 'https://ysc.org',
} as const;

export type ApiEnvironment = keyof typeof API_BASE_URLS;

/**
 * Default environment when nothing else specifies one — local, for the
 * day-to-day dev loop against a locally running backend. EAS build profiles
 * (see eas.json) explicitly set EXPO_PUBLIC_API_ENVIRONMENT to sandbox/prod
 * for development/preview/production builds regardless, so this default
 * never affects a real distributed build — only an ad-hoc `expo start`/
 * `expo run:*` invocation that bypasses the Makefile's own ENV handling.
 */
export const DEFAULT_ENVIRONMENT: ApiEnvironment = 'local';

/**
 * Resolved base URL for an environment. Use this instead of API_BASE_URLS when making requests:
 * on Android emulator, "local" resolves to 10.0.2.2:4000 (host machine); on iOS Simulator, localhost works.
 *
 * On a physical device neither of those reaches the dev machine — set
 * EXPO_PUBLIC_LOCAL_API_HOST (the dev machine's LAN IP) to override both.
 * `make android-device` sets this automatically; see scripts/run-android.sh.
 */
export function getBaseUrlForEnvironment(env: ApiEnvironment): string {
  if (env === 'local') {
    const lanHost = process.env.EXPO_PUBLIC_LOCAL_API_HOST;
    if (lanHost) return `http://${lanHost}:4000`;
    return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
  }
  return API_BASE_URLS[env];
}

/** Build-time default environment (EAS build profiles set EXPO_PUBLIC_API_ENVIRONMENT). */
export function getDefaultEnvironment(): ApiEnvironment {
  // Must be a literal `process.env.EXPO_PUBLIC_*` member expression (not a
  // dynamic/bracket lookup) — Expo's Babel plugin only inlines/references
  // EXPO_PUBLIC_ vars it can statically match by name, so reading this
  // through a helper keyed by a runtime string silently always resolves to
  // undefined in EAS builds, regardless of what eas.json sets.
  const env = process.env.EXPO_PUBLIC_API_ENVIRONMENT as ApiEnvironment | undefined;
  if (env && isValidEnvironment(env)) return env;
  return DEFAULT_ENVIRONMENT;
}

export function isValidEnvironment(value: string): value is ApiEnvironment {
  return Object.prototype.hasOwnProperty.call(API_BASE_URLS, value);
}

/**
 * Runtime API config: environment + base URL, and the signed-in user's bearer
 * token (or null before sign-in). Distinct from the property-kiosk app's
 * config, which authenticates with one static shared API key — this app
 * authenticates as a specific admin/volunteer user, so the token changes
 * every sign-in/out and is never baked into a build.
 */
export interface ApiClientConfig {
  baseUrl: string;
  token: string | null;
}

let currentEnvironment: ApiEnvironment = getDefaultEnvironment();
let currentToken: string | null = null;

export function getEnvironment(): ApiEnvironment {
  return currentEnvironment;
}

export function setEnvironment(env: ApiEnvironment): void {
  currentEnvironment = env;
}

export function getToken(): string | null {
  return currentToken;
}

export function setToken(token: string | null): void {
  currentToken = token;
}

export function getApiConfig(): ApiClientConfig {
  return { baseUrl: getBaseUrlForEnvironment(currentEnvironment), token: currentToken };
}

/** Reset in-memory config state. For use in tests only. */
export function resetConfigForTesting(): void {
  currentEnvironment = getDefaultEnvironment();
  currentToken = null;
}
