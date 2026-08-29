import {
  LEGACY_MOBILE_REDIRECT_URI,
  isMobileRedirect,
  mobileRedirectUri,
} from '@/lib/mobileRedirect';

describe('mobileRedirectUri', () => {
  it('uses the App Link path for an https backend', () => {
    expect(mobileRedirectUri('https://ysc.org')).toBe('https://ysc.org/app/auth-callback');
    expect(mobileRedirectUri('https://ysc-sandbox.fly.dev')).toBe(
      'https://ysc-sandbox.fly.dev/app/auth-callback'
    );
  });

  it('trims a trailing slash on the base URL', () => {
    expect(mobileRedirectUri('https://ysc.org/')).toBe('https://ysc.org/app/auth-callback');
  });

  it('falls back to the custom scheme for a plain-http backend', () => {
    expect(mobileRedirectUri('http://10.0.2.2:4000')).toBe(LEGACY_MOBILE_REDIRECT_URI);
    expect(mobileRedirectUri('http://localhost:4000')).toBe(LEGACY_MOBILE_REDIRECT_URI);
  });
});

describe('isMobileRedirect', () => {
  const appLink = 'https://ysc.org/app/auth-callback';

  it('matches the configured App Link redirect', () => {
    expect(isMobileRedirect('https://ysc.org/app/auth-callback?code=abc', appLink)).toBe(true);
  });

  it('always matches the legacy custom scheme (the server fallback page bounces to it)', () => {
    expect(isMobileRedirect('ysc-admin://auth-callback?code=abc', appLink)).toBe(true);
  });

  it('ignores unrelated urls', () => {
    expect(isMobileRedirect('https://ysc.org/events', appLink)).toBe(false);
    expect(isMobileRedirect('https://evil.example/app/auth-callback?code=abc', appLink)).toBe(
      false
    );
  });
});
