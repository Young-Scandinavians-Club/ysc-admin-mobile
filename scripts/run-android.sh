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
#
# Set DEVICE_ONLY=1 (or use `make android-device`) to install straight onto a
# USB-connected physical device instead of booting/using an emulator — this is
# how you get real Tap to Pay NFC hardware for testing. Requires USB debugging
# enabled on the phone (Settings > Developer options) and the device already
# authorized (`adb devices` shows it as "device", not "unauthorized").
#
# For DEVICE_ONLY, this auto-detects the dev machine's LAN IP so the device
# can reach Metro's bundle server and (with ENV=local) the API over Wi-Fi —
# override with HOST=<ip> if autodetection picks the wrong network interface,
# e.g. `make android-device HOST=192.168.0.126`.
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

# Best-effort LAN IP autodetection for physical-device testing (DEVICE_ONLY):
# neither "localhost" nor the Android emulator's 10.0.2.2 alias reaches the
# dev machine from a real phone on Wi-Fi, so both Metro's bundle server and
# ENV=local API calls need the dev machine's actual LAN IP instead.
detect_lan_ip() {
  local ip=""
  if [[ "$(uname)" == "Darwin" ]]; then
    for iface in en0 en1 en2; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      [[ -n "$ip" ]] && break
    done
  fi
  if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1)"
  fi
  if [[ -z "$ip" ]] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  echo "$ip"
}
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

DEVICE_ARG=()
DEVICE_ONLY="${DEVICE_ONLY:-}"

if [[ -n "$DEVICE_ONLY" ]]; then
  echo "==> Checking for a connected physical device (DEVICE_ONLY=1, no emulator fallback)..."

  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    echo "  Using ANDROID_SERIAL from the environment: $ANDROID_SERIAL"
  else
    PHYSICAL_SERIALS=()
    while IFS=$'\t' read -r serial state _rest; do
      [[ "$state" == "device" ]] || continue
      [[ "$serial" == emulator-* ]] && continue
      PHYSICAL_SERIALS+=("$serial")
    done < <("$ADB" devices | tail -n +2)

    if [[ ${#PHYSICAL_SERIALS[@]} -eq 0 ]]; then
      echo "error: no physical Android device found via adb." >&2
      echo "  1. Connect your phone via USB (or pair over Wi-Fi: adb pair <ip>:<port>)." >&2
      echo "  2. Enable USB debugging: Settings > About phone > tap 'Build number' 7x to" >&2
      echo "     unlock Developer options, then Settings > Developer options > USB debugging." >&2
      echo "  3. Accept the \"Allow USB debugging?\" prompt that appears on the phone." >&2
      echo "  Verify with: adb devices — it should list your device as \"device\", not" >&2
      echo "  \"unauthorized\" (re-accept the prompt) or missing entirely (try a different" >&2
      echo "  USB cable/port, or run 'adb kill-server && adb start-server')." >&2
      exit 1
    fi

    if [[ ${#PHYSICAL_SERIALS[@]} -gt 1 ]]; then
      echo "error: multiple physical devices connected — set ANDROID_SERIAL to pick one:" >&2
      printf '  %s\n' "${PHYSICAL_SERIALS[@]}" >&2
      exit 1
    fi

    export ANDROID_SERIAL="${PHYSICAL_SERIALS[0]}"
    echo "  Using connected device: $ANDROID_SERIAL"
  fi

  # Deliberately not `--device <serial>`: Expo's CLI does its own device-name
  # lookup for that flag, which doesn't recognize wireless-ADB serials (e.g.
  # "adb-XXXX._adb-tls-connect._tcp" from `adb pair`) even though `adb` itself
  # sees them fine. Exporting ANDROID_SERIAL instead makes every adb/gradle
  # call underneath target it directly, the same way it already works when
  # exactly one device is connected and no --device is passed at all below.
elif "$ADB" devices | grep -qE "(device|emulator-[0-9]+)$"; then
  echo "==> Checking for a connected device or running emulator..."
  echo "  A device/emulator is already connected."
else
  echo "==> Checking for a connected device or running emulator..."
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
  EMULATOR_LOG="$(mktemp -t expo-android-emulator.XXXXXX.log)"
  echo "  Emulator log: $EMULATOR_LOG"
  nohup "$EMULATOR" -avd "$AVD_NAME" -netdelay none -netspeed full >"$EMULATOR_LOG" 2>&1 &
  disown

  echo "==> Waiting for emulator to finish booting..."
  "$ADB" wait-for-device
  BOOT_DEADLINE=$(($(date +%s) + 180))
  until "$ADB" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; do
    if [[ "$(date +%s)" -ge "$BOOT_DEADLINE" ]]; then
      echo "error: emulator didn't finish booting within 180s." >&2
      echo "  Check the emulator log: $EMULATOR_LOG" >&2
      exit 1
    fi
    sleep 2
  done
  echo "  Emulator ready."

  DEVICE_ARG=(--device "$AVD_NAME")
fi

if [[ -n "$DEVICE_ONLY" ]]; then
  HOST="${HOST:-}"
  if [[ -z "$HOST" ]]; then
    HOST="$(detect_lan_ip)"
    if [[ -n "$HOST" ]]; then
      echo "==> Auto-detected LAN IP: $HOST (override with HOST=<ip>)"
    else
      echo "warning: couldn't auto-detect a LAN IP — Metro's bundle server and" >&2
      echo "  ENV=local API calls may not reach this machine from the device." >&2
      echo "  Set HOST=<this-machine's-LAN-IP> explicitly if the app fails to load." >&2
    fi
  else
    echo "==> Using LAN IP: $HOST"
  fi

  if [[ -n "$HOST" ]]; then
    # Lets Metro advertise this IP for bundle loading over Wi-Fi...
    export REACT_NATIVE_PACKAGER_HOSTNAME="$HOST"
    # ...and lets the app's own ENV=local API calls reach this machine too
    # (see api/config.ts's getBaseUrlForEnvironment).
    export EXPO_PUBLIC_LOCAL_API_HOST="$HOST"
  fi
fi

echo "==> Building and launching the app (npx expo run:android)..."
# Avoid expanding an empty array under `set -u`: harmless on modern bash, but
# stock macOS ships bash 3.2, which treats that as an unbound-variable error.
if [[ ${#DEVICE_ARG[@]} -gt 0 ]]; then
  exec npx expo run:android "${DEVICE_ARG[@]}"
else
  exec npx expo run:android
fi
