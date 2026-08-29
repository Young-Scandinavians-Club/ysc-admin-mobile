/**
 * Where ysc.org should hand the one-time sign-in code back to.
 *
 * For an https backend we use the Android App Link
 * `https://<host>/app/auth-callback` — a verified App Link opens the app
 * directly on a user tap and degrades to a real web page when the app isn't
 * installed. For a plain-http backend (local dev against `10.0.2.2` /
 * `localhost`) an App Link is impossible, so we fall back to the
 * `ysc-admin://` private-use scheme.
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

/** The `mobile_redirect_uri` to ask the web login page for, given the API base URL. */
export function mobileRedirectUri(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) {
    return `${baseUrl.replace(/\/+$/, '')}${APP_LINK_PATH}`;
  }
  return LEGACY_MOBILE_REDIRECT_URI;
}

/** True when `url` is a sign-in handoff redirect this flow should intercept. */
export function isMobileRedirect(url: string, redirectUri: string): boolean {
  return url.startsWith(redirectUri) || url.startsWith(LEGACY_MOBILE_REDIRECT_URI);
}
