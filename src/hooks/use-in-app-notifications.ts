import * as React from 'react';

import { api } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

export interface InAppNotification {
  id: number | string;
  title: string;
  body: string;
  type: AppNotification['type'];
}

interface NotificationsResponse {
  unread: number;
  results: AppNotification[];
}

const POLL_INTERVAL_MS = 20_000;
const MAX_SEEN_IDS = 200;

function trimSeen(seen: Set<number>, currentIds: Set<number>) {
  while (seen.size > MAX_SEEN_IDS) {
    let victim: number | undefined;
    for (const id of seen) {
      if (!currentIds.has(id)) {
        victim = id;
        break;
      }
    }
    if (victim === undefined) return;
    seen.delete(victim);
  }
}

export function useInAppNotifications(enabled: boolean): {
  latest: InAppNotification | null;
  dismiss: () => void;
  unread: number;
} {
  const [latest, setLatest] = React.useState<InAppNotification | null>(null);
  const [unread, setUnread] = React.useState(0);
  const seenRef = React.useRef<Set<number> | null>(null);

  const dismiss = React.useCallback(() => setLatest(null), []);

  React.useEffect(() => {
    if (!enabled) {
      setLatest(null);
      return;
    }
    let cancelled = false;

    async function poll() {
      try {
        const res = await api<NotificationsResponse>('notifications/');
        if (cancelled) return;
        setUnread(res.unread ?? 0);
        const results = res.results ?? [];
        const currentIds = new Set(results.map((n) => n.id));
        const seen = seenRef.current;
        if (seen === null) {
          seenRef.current = new Set(currentIds);
          return;
        }
        let newest: InAppNotification | null = null;
        for (const n of results) {
          if (seen.has(n.id)) continue;
          if (newest === null) {
            newest = { id: n.id, title: n.title, body: n.body, type: n.type };
          }
          seen.add(n.id);
        }
        trimSeen(seen, currentIds);
        if (newest) setLatest(newest);
      } catch {
        return;
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return { latest, dismiss, unread };
}
