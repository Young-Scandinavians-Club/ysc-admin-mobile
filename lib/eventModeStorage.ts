import * as SecureStore from 'expo-secure-store';

const KEY_PINNED_EVENT = 'ysc_admin_pinned_event';

/** The event a volunteer has pinned for "event mode" — the app opens straight
 *  into member search for it instead of the Home list. */
export interface PinnedEvent {
  id: string;
  title: string;
}

function isPinnedEvent(value: unknown): value is PinnedEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PinnedEvent).id === 'string' &&
    typeof (value as PinnedEvent).title === 'string'
  );
}

/** Returns null if nothing is pinned or on error (e.g. SecureStore unavailable on web). */
export async function loadPinnedEvent(): Promise<PinnedEvent | null> {
  try {
    const json = await SecureStore.getItemAsync(KEY_PINNED_EVENT);
    if (!json) return null;
    const parsed = JSON.parse(json) as unknown;
    return isPinnedEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePinnedEvent(event: PinnedEvent): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_PINNED_EVENT, JSON.stringify(event));
  } catch {
    // e.g. SecureStore not available on web
  }
}

export async function clearPinnedEvent(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_PINNED_EVENT);
  } catch {
    // no-op
  }
}
