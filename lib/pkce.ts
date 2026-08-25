import * as Crypto from 'expo-crypto';

/**
 * PKCE-style binding for the browser-handoff login (see auth-context.tsx's
 * `signIn`). `ysc-admin://` is a private-use URI scheme another installed
 * app could also register, so the redirect's bare one-time code alone isn't
 * proof this app is who's exchanging it. The verifier is generated here and
 * never leaves this app; only its digest (the challenge) goes out in the
 * login URL, so a different app that merely wins the OS's "open this link"
 * race still can't complete the exchange.
 *
 * Not RFC 7636's base64url encoding — this isn't a spec-compliant OAuth PKCE
 * exchange, just a same-shape verifier/challenge binding with the one
 * backend that consumes it (see YscWeb.UserAuth.valid_code_challenge?/1),
 * so hex end-to-end avoids any base64url padding/charset mismatch between
 * this and the Elixir side.
 */
export async function generatePkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const codeVerifier = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const codeChallenge = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier
  );

  return { codeVerifier, codeChallenge };
}
