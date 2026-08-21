# YSC Admin App

Expo/React Native app for YSC admins and volunteers: sign in, then take
payments via Stripe Tap to Pay for events and memberships. Talks to the
`/api/v1/app/*` endpoints in [ysc.org](../ysc.org).

## Status

- **Sign-in**: email + password works end-to-end. Google, Facebook, and
  passkey sign-in are stubbed in the UI ("coming soon") pending their backend
  endpoints.
- **Events**: list view wired to the backend.
- **Tap-to-pay checkout / membership sign-up**: not yet built — the backend
  endpoints exist (`/tickets/:id/payment_intent`, `/memberships/subscribe`,
  `/payments/connection_token`), the Stripe Terminal SDK integration in the
  app is next.

## Requirements

This app **cannot run in Expo Go** — the Stripe Terminal SDK needs native
modules, so it always requires a custom dev client (`expo prebuild` +
`expo run:ios` / `expo run:android`, or an EAS development build).

- Node 20+, npm
- macOS + Xcode + CocoaPods for iOS
- Android Studio (SDK + an emulator or device) for Android
- A physical NFC-capable device to test a real card tap. On iOS, Apple's
  "Tap to Pay on iPhone" entitlement must be granted to the Apple Developer
  account first (apply at developer.apple.com — this can take days and is
  outside this app's code). Until then, use Stripe Terminal's simulated
  reader against the sandbox backend.
  - Once granted, add the `com.apple.developer.proximity-reader.payment.acceptance`
    entitlement to `app.json`'s `ios.entitlements` (not added yet — an
    ungranted entitlement can fail codesigning, so it's left out until
    Apple actually approves it for this account/provisioning profile).

## Environments

Three environments, matching the backend's deploys:

| Environment | Base URL | Stripe mode |
| --- | --- | --- |
| `local` | `http://localhost:4000` (`10.0.2.2:4000` on Android emulator) | test |
| `sandbox` (default) | `https://ysc-sandbox.fly.dev` | test |
| `prod` | `https://ysc.org` | live |

All development and testing should happen against **sandbox** — never
`prod`. The environment is set at build time via `EXPO_PUBLIC_API_ENVIRONMENT`
(see `eas.json` build profiles) and defaults to `sandbox` if unset, so a
stray build never accidentally talks to production.

## Setup

```bash
npm install
make ios      # or: make android
```

Both `make ios`/`make android` check for prerequisites, run `expo prebuild`,
and launch the app. See `scripts/run-ios.sh` / `scripts/run-android.sh`.

## Other commands

```bash
make lint        # eslint + prettier --check
make format      # eslint --fix + prettier --write
make typecheck    # tsc --noEmit
make test        # jest
```

## Architecture

- `api/` — typed API client (`config.ts`, `client.ts`, `endpoints.ts`,
  `types.ts`), mirroring the pattern used by the sibling `property-kiosk` app,
  but authenticating as a specific admin/volunteer user (bearer token) rather
  than a shared kiosk API key.
- `lib/auth-context.tsx` — sign-in/out, current user, and environment state;
  `lib/authStorage.ts` persists the session in `expo-secure-store`.
- `components/navigation/` — React Navigation native-stack, switching between
  the sign-in screen and the signed-in app based on auth state.
- `components/screens/` — screens.
