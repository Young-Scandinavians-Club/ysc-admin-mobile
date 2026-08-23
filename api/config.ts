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
 */
export function getBaseUrlForEnvironment(env: ApiEnvironment): string {
  if (env === 'local') {
    return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
  }
  return API_BASE_URLS[env];
}

/** Read a process.env value by name without triggering Expo's static EXPO_PUBLIC_ inlining. */
function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return (process.env as Record<string, string | undefined>)[key];
}

/** Build-time default environment (EAS build profiles set EXPO_PUBLIC_API_ENVIRONMENT). */
export function getDefaultEnvironment(): ApiEnvironment {
  const env = readEnv('EXPO_PUBLIC_API_ENVIRONMENT') as ApiEnvironment | undefined;
  if (env && env in API_BASE_URLS) return env;
  return DEFAULT_ENVIRONMENT;
}

export function isValidEnvironment(value: string): value is ApiEnvironment {
  return value in API_BASE_URLS;
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
