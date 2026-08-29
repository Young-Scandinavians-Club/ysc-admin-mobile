/**
 * Where ysc.org should hand the one-time sign-in code back to.
 *
 * On **Android** against an https backend we use the App Link
 * `https://<host>/app/auth-callback` — a verified App Link opens the app
 * directly on a user tap and degrades to a real web page when the app isn't
 * installed. Everywhere else — iOS (no Universal Links / `associatedDomains`
 * set up) and local dev over plain http — we use the `ysc-admin://`
 * private-use scheme.
 *
 * Both the resolved value and the legacy custom scheme must appear in
 * ysc.org's `YscWeb.UserAuth.valid_mobile_redirect_uri?/1` allowlist, and
 * the App Link hosts/path must match `android.intentFilters` in app.json
 * plus each host's `/.well-known/assetlinks.json`.
 */

/** Private-use scheme fallback. Also the scheme ysc.org's App Link landing
 *  page (`/app/auth-callback`) bounces to, so we always accept it back. */
export const LEGACY_MOBILE_REDIRECT_URI = 'ysc-admin://auth-callback';

const APP_LINK_PATH = '/app/auth-callback';

/**
 * The `mobile_redirect_uri` to ask the web login page for.
 *
 * @param baseUrl  the resolved API base URL (`getApiConfig().baseUrl`)
 * @param platform `Platform.OS` — App Links are Android-only here
 */
export function mobileRedirectUri(baseUrl: string, platform: string): string {
  if (platform === 'android' && baseUrl.startsWith('https://')) {
    return `${baseUrl.replace(/\/+$/, '')}${APP_LINK_PATH}`;
  }
  return LEGACY_MOBILE_REDIRECT_URI;
}

/** True when `prefix` is `url` up to an exact end / `?` / `#` boundary. */
function matchesUri(url: string, prefix: string): boolean {
  if (!url.startsWith(prefix)) return false;
  const next = url[prefix.length];
  return next === undefined || next === '?' || next === '#';
}

/** True when `url` is a sign-in handoff redirect this flow should intercept. */
export function isMobileRedirect(url: string, redirectUri: string): boolean {
  return matchesUri(url, redirectUri) || matchesUri(url, LEGACY_MOBILE_REDIRECT_URI);
}
