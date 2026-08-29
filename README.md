# YSC Admin App

Expo/React Native app for YSC admins and volunteers: sign in, then take
payments via Stripe Tap to Pay for events and memberships. Talks to the
`/api/v1/app/*` endpoints in [ysc.org](../ysc.org).

## Status

- **Sign-in**: opens the real ysc.org login page in a system browser tab, so
  every method the website supports (password, Google, Facebook) works —
  the app never implements its own auth forms. Passkey sign-in works the
  same way once the website supports it in that flow.
- **Events**: list view wired to the backend.
- **Tap-to-pay checkout / membership sign-up**: built end-to-end — Stripe
  Terminal collects the card for both one-off ticket payments and membership
  card-on-file setup, confirmed against the sandbox backend. Real hardware
  taps still need the Apple/Android entitlements described below.

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

| Environment       | Base URL                                                      | Stripe mode |
| ----------------- | ------------------------------------------------------------- | ----------- |
| `local` (default) | `http://localhost:4000` (`10.0.2.2:4000` on Android emulator) | test        |
| `sandbox`         | `https://ysc-sandbox.fly.dev`                                 | test        |
| `prod`            | `https://ysc.org`                                             | live        |

`make ios`/`make android`/`make web` default to **local** — run `ysc.org`
locally (`mix phx.server`) alongside this app. Pick a different one with
`ENV=`, e.g.:

```bash
make ios ENV=sandbox
make android ENV=prod
```

Never run against `prod` unless you specifically mean to. For a real EAS
build, the environment is set by the build profile instead (see `eas.json`:
`development`/`preview` → sandbox, `production` → prod), regardless of this
default — see `api/config.ts`'s `DEFAULT_ENVIRONMENT` for the exact fallback
rules.

## Sign-in deep linking

Sign-in opens ysc.org's login page in a system browser tab; the website
then hands a one-time code back to the app. The redirect target depends on
the backend:

- **https backend** (sandbox/prod): an **Android App Link**,
  `https://<host>/app/auth-callback` — declared in `app.json`
  (`android.intentFilters`, `autoVerify`) and resolved at runtime by
  `lib/mobileRedirect.ts`. A verified App Link opens the app directly; when
  unverified or the app isn't installed it falls back to a web page that
  bounces to the `ysc-admin://` scheme.
- **http backend** (local dev): the `ysc-admin://auth-callback` custom
  scheme (App Links require https).

`expo prebuild` regenerates `android/` (gitignored) from `app.json`, so a
build picks up the intent filters automatically. The server side — the
`assetlinks.json` each host must serve, the redirect-URI allowlist, and how
to get the signing-cert fingerprints — is documented in
[`../ysc.org/docs/MOBILE_APP_AUTH_HANDOFF.md`](../ysc.org/docs/MOBILE_APP_AUTH_HANDOFF.md).

## Setup

```bash
npm install
make ios      # or: make android — defaults to ENV=local (localhost:4000)
```

Both `make ios`/`make android` check for prerequisites, run `expo prebuild`,
and launch the app. See `scripts/run-ios.sh` / `scripts/run-android.sh`.

To install straight onto a USB-connected physical Android device (needed for
real Stripe Terminal Tap to Pay/NFC — the emulator has no NFC hardware),
enable USB debugging on the phone and run:

```bash
make android-device   # skips the emulator entirely; errors if no device is found
```

`android-device` auto-detects this machine's LAN IP so the phone can reach
Metro's bundle server and (with `ENV=local`) the API over Wi-Fi — override
with `HOST=<ip>` if autodetection picks the wrong network interface, e.g.
`make android-device HOST=192.168.0.126`. If avatar/event images don't load,
the backend needs the same IP too — see `ysc.org`'s `make dev HOST=<ip>`.

## Other commands

```bash
make lint        # eslint + prettier --check
make format      # eslint --fix + prettier --write
make typecheck    # tsc --noEmit
make test        # jest
```

## Releases

This app isn't on the App Store / Play Store — it's distributed straight to
the team as installable builds via EAS's **internal distribution**. Two
workflows build automatically and publish each build's install link to the
repo's **Releases** page — no digging through Actions logs:

| Trigger                                                                              | Workflow                                               | Platforms     | `eas.json` profile | Backend | Where the links land                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------- | ------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| Every push to `main` (i.e. every merged PR)                                          | [`sandbox-build`](.github/workflows/sandbox-build.yml) | Android only  | `preview`          | sandbox | the rolling [`sandbox-latest`](../../releases/tag/sandbox-latest) release, recreated on every push |
| Pushing a version tag, e.g. `git tag v1.2.0 && git push origin v1.2.0` (from `main`) | [`release-build`](.github/workflows/release-build.yml) | iOS + Android | `production`       | prod    | the release for that tag                                                                           |

So the team can always bookmark `sandbox-latest` for a current Android build
to poke at, while a tagged release is the deliberate "ship this to prod"
build, on both platforms, with its own permanent release page.

`sandbox-build` skips iOS for now — internal-distribution iOS builds need ad
hoc credentials set up interactively per profile (see below), which hasn't
been done for `preview`. Add an `ios` step back once that's worth doing.

One-time setup:

- **`EXPO_TOKEN` repo secret**: an [Expo access
  token](https://expo.dev/accounts/[account]/settings/access-tokens) with
  permission to build this project, added under repo Settings → Secrets and
  variables → Actions.
- **iOS credentials** (production builds only, for now): internal-distribution
  iOS builds are ad hoc, which needs a distribution certificate + ad hoc
  provisioning profile set up once, interactively:
  `eas credentials --platform ios --profile production`. Each teammate's
  device UDID also needs registering before it can install a build:
  `eas device:create` (adds it to the ad hoc provisioning profile; the next
  iOS build picks it up). Android has no such step — the `.apk` install link
  just works.

Team members install straight from the build's EAS page (QR code or link);
no TestFlight/Play internal-testing enrollment needed.

## Design system

UI styling follows `ysc.org`'s `STYLE_GUIDE.md` and `assets/tailwind.config.js`
as closely as NativeWind allows, so the app reads as the same product as the
web admin dashboard rather than a re-skin:

- **Colors**: the exact same `blue` palette override from the web app's
  Tailwind config (`tailwind.config.js` here), not Tailwind's stock blue —
  `blue-700`/`blue-800` for primary actions, `blue-900` (`#144993`) as the
  brand mark. Neutrals are **zinc only** (`gray-*`/`slate-*` are banned in the
  style guide — don't reintroduce them here either).
- **Buttons**: `rounded` (not `rounded-md`/`rounded-lg`), `bg-blue-700`,
  `disabled:opacity-80`, and `active:scale-[0.98]` — matches the web
  `<.button>` component's press state exactly, one-to-one, as plain NativeWind
  utility classes (`transition-transform duration-150 ease-in-out
active:scale-[0.98]`). Entrance fades (e.g. on `SignInScreen`) are likewise
  a plain `transition-all`/`opacity`/`translate-y` class toggle, not an
  imperative animation call.
- **Cards**: `bg-white rounded-xl border border-zinc-100`, matching the web's
  "standard content card".
- **Form errors**: `text-rose-600` (the style guide reserves `rose-*`
  specifically for form validation text, `red-*` for general/destructive
  errors).
- Animations stay in CSS/NativeWind, not Reanimated's imperative API
  (`useSharedValue`/`useAnimatedStyle`): the two don't compose cleanly on a
  single element (NativeWind's `className`-driven style and Reanimated's
  worklet-driven `style` fight over the same node), and NativeWind's own
  `transition-*`/pseudo-class (`active:`, `disabled:`) utilities cover
  everything this app needs. Note `react-native-reanimated`/
  `react-native-worklets` are still real, version-pinned dependencies even so
  — NativeWind's underlying `react-native-css-interop` has a hard peer
  dependency on Reanimated, so they can't be removed even though nothing in
  this app calls Reanimated's API directly.
- Minimum touch target `min-h-[44px]` on every interactive element, per the
  style guide's accessibility checklist (this matters more here than on web,
  since everything is touch).

When building the Phase D checkout/membership screens, pull from the same
palette/spacing conventions rather than inventing new ones.

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
