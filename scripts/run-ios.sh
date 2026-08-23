#!/usr/bin/env bash
# Runs the app in the iOS Simulator, checking and installing prerequisites first.
# Defaults to an iPhone (this is an admin/volunteer phone app, not a tablet kiosk).
# Override with: IOS_SIMULATOR_DEVICE="iPhone 16 Pro" make ios
#
# Backend environment defaults to local. Override with:
#   make ios ENV=local       # http://localhost:4000 (default)
#   make ios ENV=sandbox     # https://ysc-sandbox.fly.dev
#   make ios ENV=prod        # https://ysc.org
#
# Note: Stripe Tap to Pay on iPhone cannot be tested in the Simulator (no NFC) —
# use this for the sign-in/events/checkout UI, and Stripe Terminal's simulated
# reader for the payment collection flow. A physical iPhone plus the granted
# Apple entitlement is required to test a real card tap.
set -euo pipefail
cd "$(dirname "$0")/.."

API_ENV="${API_ENV:-local}"
case "$API_ENV" in
  local | sandbox | prod) ;;
  *)
    echo "error: invalid ENV '$API_ENV' — expected local, sandbox, or prod." >&2
    exit 1
    ;;
esac
export EXPO_PUBLIC_API_ENVIRONMENT="$API_ENV"
echo "==> Backend environment: $API_ENV"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "error: the iOS Simulator only runs on macOS (you're on $(uname))." >&2
  exit 1
fi

echo "==> Checking Xcode command line tools..."
if ! xcode-select -p >/dev/null 2>&1; then
  echo "error: Xcode command line tools not found." >&2
  echo "  Install Xcode from the App Store, then run: xcode-select --install" >&2
  exit 1
fi

echo "==> Checking CocoaPods..."
if ! command -v pod >/dev/null 2>&1; then
  echo "  CocoaPods not found — installing via gem (you may be prompted for your password)..."
  sudo gem install cocoapods
fi

echo "==> Checking node_modules..."
if [[ ! -d node_modules ]]; then
  echo "  node_modules missing — running npm install..."
  npm install
fi

# ios/ is gitignored and regenerated on demand (managed workflow — nothing in
# it should be hand-edited). Regenerating on every run guarantees it always
# matches whatever's actually in node_modules; otherwise a leftover project
# from before a dependency bump can reference symbols that no longer exist
# in the currently installed native packages, failing the build with a
# confusing compiler error instead of an obvious "stale project" message.
echo "==> Regenerating native iOS project (expo prebuild --clean)..."
npx expo prebuild --clean --platform ios

echo "==> Checking for an iPhone simulator..."
IPHONE_DEVICE="${IOS_SIMULATOR_DEVICE:-}"

if [[ -z "$IPHONE_DEVICE" ]]; then
  IPHONE_DEVICE="$(
    xcrun simctl list devices available 2>/dev/null \
      | grep -E "^\s+iPhone" \
      | sed -E 's/^[[:space:]]+//; s/ \([A-F0-9-]+\).*$//' \
      | head -n1 || true
  )"
fi

if [[ -z "$IPHONE_DEVICE" ]]; then
  echo "  No iPhone simulator found — creating one..."
  DEVICETYPE_LINE="$(xcrun simctl list devicetypes 2>/dev/null | grep "iPhone" | head -n1 || true)"
  RUNTIME_ID="$(
    xcrun simctl list runtimes available 2>/dev/null \
      | grep "iOS" \
      | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+' \
      | head -n1 || true
  )"

  if [[ -z "$DEVICETYPE_LINE" || -z "$RUNTIME_ID" ]]; then
    echo "error: no iPhone device type or iOS runtime available to create a simulator from." >&2
    echo "  Open Xcode > Settings > Platforms and install an iOS simulator runtime." >&2
    exit 1
  fi

  DEVICETYPE_ID="$(echo "$DEVICETYPE_LINE" | grep -oE '\(com\.apple\.CoreSimulator\.SimDeviceType\.[^)]+\)' | tr -d '()')"
  DEVICETYPE_NAME="$(echo "$DEVICETYPE_LINE" | sed -E 's/ \(com\.apple\.CoreSimulator\.SimDeviceType\.[^)]+\)$//')"

  xcrun simctl create "$DEVICETYPE_NAME" "$DEVICETYPE_ID" "$RUNTIME_ID" >/dev/null
  IPHONE_DEVICE="$DEVICETYPE_NAME"
fi

echo "  Using: $IPHONE_DEVICE"

echo "==> Opening Simulator..."
open -a Simulator

echo "==> Building and launching the app (npx expo run:ios --device \"$IPHONE_DEVICE\")..."
exec npx expo run:ios --device "$IPHONE_DEVICE"
