import * as React from 'react';
import { api } from '@/lib/api';

let cachedUnread = 0;
const listeners = new Set<(n: number) => void>();

export function setUnreadCount(n: number) {
  cachedUnread = n;
  listeners.forEach((l) => l(n));
}

export function useUnreadChatCount(): number {
  const [unread, setUnread] = React.useState(cachedUnread);

  React.useEffect(() => {
    const listener = (n: number) => setUnread(n);
    listeners.add(listener);

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = (await api<{ results?: { unread?: number }[] } | { unread?: number }[]>(
          'chat/threads/'
        )) as { results?: { unread?: number }[] } | { unread?: number }[];
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res.results ?? []);
        const total = list.reduce((sum, t) => sum + (t.unread ?? 0), 0);
        setUnreadCount(total);
      } catch {
        /* ignore polling errors */
      }
    }, 30_000);

    return () => {
      cancelled = true;
      listeners.delete(listener);
      clearInterval(interval);
    };
  }, []);

  return unread;
}
