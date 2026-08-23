#!/usr/bin/env bash
# Runs the app in an Android Emulator, checking and installing prerequisites first.
# Defaults to a phone AVD (this is an admin/volunteer phone app, not a tablet kiosk).
# Override with: ANDROID_AVD_NAME=Pixel_7_API_34 make android
#
# Backend environment defaults to local. Override with:
#   make android ENV=local     # http://10.0.2.2:4000, i.e. the host's localhost:4000 (default)
#   make android ENV=sandbox   # https://ysc-sandbox.fly.dev
#   make android ENV=prod      # https://ysc.org
#
# Note: Stripe Tap to Pay on Android needs a real NFC-capable device — the
# emulator has no NFC, so use this for the sign-in/events/checkout UI, and
# Stripe Terminal's simulated reader for the payment collection flow.
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

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$ANDROID_SDK" || ! -d "$ANDROID_SDK" ]]; then
  echo "error: Android SDK not found (ANDROID_HOME/ANDROID_SDK_ROOT is not set or invalid)." >&2
  echo "  Install Android Studio (https://developer.android.com/studio), open it once to" >&2
  echo "  finish SDK setup, then set ANDROID_HOME to its 'Android/sdk' directory." >&2
  exit 1
fi

EMULATOR="$ANDROID_SDK/emulator/emulator"
ADB="$ANDROID_SDK/platform-tools/adb"
# find exits non-zero when cmdline-tools doesn't exist yet; with `set -o pipefail`
# that would otherwise kill the script before we get a chance to fall back below.
AVDMANAGER="$(find "$ANDROID_SDK/cmdline-tools" -name avdmanager -maxdepth 3 2>/dev/null | head -n1 || true)"
SDKMANAGER="$(find "$ANDROID_SDK/cmdline-tools" -name sdkmanager -maxdepth 3 2>/dev/null | head -n1 || true)"

for tool_path in "$EMULATOR" "$ADB"; do
  if [[ ! -x "$tool_path" ]]; then
    echo "error: required tool not found at $tool_path." >&2
    echo "  Install it via Android Studio > Settings > SDK Manager > SDK Tools." >&2
    exit 1
  fi
done

echo "==> Checking Java version (this project's Gradle needs JDK 17-23)..."
JAVA_BIN="java"
[[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]] && JAVA_BIN="$JAVA_HOME/bin/java"

if ! command -v "$JAVA_BIN" >/dev/null 2>&1; then
  echo "error: no Java runtime found (checked \$JAVA_HOME and PATH)." >&2
  echo "  Install a JDK 17 or 21 and set JAVA_HOME to it — Android Studio bundles a" >&2
  echo "  compatible one under its install directory's 'jbr' folder." >&2
  exit 1
fi

JAVA_VERSION_LINE="$("$JAVA_BIN" -version 2>&1 | head -n1)"
JAVA_MAJOR="$(echo "$JAVA_VERSION_LINE" | grep -oE '"[0-9]+' | tr -d '"' | head -n1 || true)"

if [[ -n "$JAVA_MAJOR" ]] && { [[ "$JAVA_MAJOR" -lt 17 ]] || [[ "$JAVA_MAJOR" -gt 23 ]]; }; then
  echo "error: $JAVA_VERSION_LINE is not supported by this project's Gradle version." >&2
  echo "  Gradle 8.x supports JDK 17-23. Install a JDK in that range and either:" >&2
  echo "    - set JAVA_HOME to it before running make android, or" >&2
  echo "    - point at Android Studio's bundled JDK (its install dir's 'jbr' folder)." >&2
  exit 1
fi

echo "==> Checking node_modules..."
if [[ ! -d node_modules ]]; then
  echo "  node_modules missing — running npm install..."
  npm install
fi

# android/ is gitignored and regenerated on demand (managed workflow — nothing in
# it should be hand-edited). Regenerating on every run guarantees it always
# matches whatever's actually in node_modules; otherwise a leftover project
# from before a dependency bump can reference symbols (e.g. an older
# expo-modules-core's ReactNativeHostWrapper) that no longer exist, failing
# the build with a confusing Kotlin "Unresolved reference" error.
echo "==> Regenerating native Android project (expo prebuild --clean)..."
npx expo prebuild --clean --platform android

echo "==> Checking for a connected device or running emulator..."
DEVICE_ARG=()
if "$ADB" devices | grep -qE "(device|emulator-[0-9]+)$"; then
  echo "  A device/emulator is already connected."
else
  AVD_NAME="${ANDROID_AVD_NAME:-}"
  AVD_LIST="$("$EMULATOR" -list-avds 2>/dev/null || true)"

  if [[ -z "$AVD_NAME" ]]; then
    AVD_NAME="$(echo "$AVD_LIST" | head -n1 || true)"
  fi

  if [[ -z "$AVD_NAME" ]]; then
    echo "==> No AVD found — creating a default phone AVD..."
    if [[ -z "$AVDMANAGER" || -z "$SDKMANAGER" ]]; then
      echo "error: avdmanager/sdkmanager not found." >&2
      echo "  Install 'Android SDK Command-line Tools' via Android Studio > SDK Manager > SDK Tools." >&2
      exit 1
    fi

    ARCH="$(uname -m)"
    if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
      IMAGE_ARCH="arm64-v8a"
    else
      IMAGE_ARCH="x86_64"
    fi
    SYSTEM_IMAGE="system-images;android-34;google_apis;${IMAGE_ARCH}"

    echo "  Installing system image: $SYSTEM_IMAGE (this can take a while)..."
    yes | "$SDKMANAGER" --install "$SYSTEM_IMAGE" >/dev/null

    AVD_NAME="Pixel_7_API_34"
    echo "  Creating AVD: $AVD_NAME (device profile: pixel_7)..."
    echo "no" | "$AVDMANAGER" create avd -n "$AVD_NAME" -k "$SYSTEM_IMAGE" -d "pixel_7" --force
  fi

  echo "==> Booting emulator: $AVD_NAME (this can take a minute)..."
  nohup "$EMULATOR" -avd "$AVD_NAME" -netdelay none -netspeed full >/tmp/expo-android-emulator.log 2>&1 &
  disown

  echo "==> Waiting for emulator to finish booting..."
  "$ADB" wait-for-device
  until "$ADB" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; do
    sleep 2
  done
  echo "  Emulator ready."

  DEVICE_ARG=(--device "$AVD_NAME")
fi

echo "==> Building and launching the app (npx expo run:android)..."
# Avoid expanding an empty array under `set -u`: harmless on modern bash, but
# stock macOS ships bash 3.2, which treats that as an unbound-variable error.
if [[ ${#DEVICE_ARG[@]} -gt 0 ]]; then
  exec npx expo run:android "${DEVICE_ARG[@]}"
else
  exec npx expo run:android
fi
