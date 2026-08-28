import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  clearPinnedEvent,
  loadPinnedEvent,
  type PinnedEvent,
  savePinnedEvent,
} from '@/lib/eventModeStorage';

interface EventModeContextValue {
  /** The pinned event, or null when not in event mode. */
  pinnedEvent: PinnedEvent | null;
  /** False until the persisted value has been read on startup. */
  ready: boolean;
  pinEvent: (event: PinnedEvent) => void;
  unpinEvent: () => void;
}

const EventModeContext = createContext<EventModeContextValue | null>(null);

/**
 * "Event mode": a volunteer working one door for a shift pins that event so
 * the app opens straight into member search for it (see HomeScreen), instead
 * of scrolling the event list every time the shared device is picked up
 * again. Persisted so it survives an app relaunch; cleared only by an
 * explicit "Change event".
 */
export function EventModeProvider({ children }: { children: ReactNode }) {
  const [pinnedEvent, setPinnedEvent] = useState<PinnedEvent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPinnedEvent().then((stored) => {
      if (cancelled) return;
      setPinnedEvent(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pinEvent = useCallback((event: PinnedEvent) => {
    setPinnedEvent(event);
    void savePinnedEvent(event);
  }, []);

  const unpinEvent = useCallback(() => {
    setPinnedEvent(null);
    void clearPinnedEvent();
  }, []);

  const value = useMemo<EventModeContextValue>(
    () => ({ pinnedEvent, ready, pinEvent, unpinEvent }),
    [pinnedEvent, ready, pinEvent, unpinEvent]
  );

  return <EventModeContext.Provider value={value}>{children}</EventModeContext.Provider>;
}

export function useEventMode(): EventModeContextValue {
  const ctx = useContext(EventModeContext);
  if (!ctx) throw new Error('useEventMode must be used within an EventModeProvider');
  return ctx;
}
