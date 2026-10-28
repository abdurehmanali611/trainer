import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import {
  BellIcon,
  CalendarClockIcon,
  CreditCardIcon,
  InboxIcon,
  MessageSquareIcon,
  TrophyIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react-native';

import { EmptyView, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { relativeTime } from '@/lib/dates';
import type { AppNotification } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<AppNotification['type'], LucideIcon> = {
  booking: CalendarClockIcon,
  payment: CreditCardIcon,
  message: MessageSquareIcon,
  alert: TriangleAlertIcon,
  achievement: TrophyIcon,
  request: InboxIcon,
};

export default function NotificationsScreen() {
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (initial?: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await api<{ unread: number; results: AppNotification[] }>('notifications/');
      setItems(res.results);
      setUnread(res.unread);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(true);
  }, [load]);

  async function markRead(notification: AppNotification) {
    if (notification.read) return;
    setItems((list) => list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    setUnread((count) => Math.max(0, count - 1));
    try {
      await api(`notifications/${notification.id}/read/`, { method: 'POST', body: {} });
    } catch {
      setItems((list) => list.map((n) => (n.id === notification.id ? { ...n, read: false } : n)));
      setUnread((count) => count + 1);
    }
  }

  async function markAllRead() {
    const first = items[0];
    if (!first) return;
    const previous = items;
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await api(`notifications/${first.id}/read/`, { method: 'POST', body: { all: true } });
    } catch (e) {
      setItems(previous);
      setUnread(previous.filter((n) => !n.read).length);
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading notifications…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false}>
        <ErrorView error={error} onRetry={() => void load(true)} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void load()}>
      <ScreenHeader title="Notifications" />
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text variant="muted">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </Text>
        <Button size="sm" variant="ghost" disabled={unread === 0} onPress={() => void markAllRead()}>
          <Text>Mark all read</Text>
        </Button>
      </View>

      {items.length === 0 ? (
        <EmptyView title="No notifications" subtitle="Bookings, payments and requests appear here." />
      ) : (
        <View className="gap-2">
          {items.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => void markRead(notification)}
              className={cn(
                'gap-1.5 rounded-xl border border-border bg-card p-4 active:opacity-70',
                !notification.read && 'border-l-primary bg-accent/50 border-l-4'
              )}>
              <View className="flex-row items-center gap-2">
                <Icon
                  as={TYPE_ICONS[notification.type] ?? BellIcon}
                  size={16}
                  className="text-muted-foreground"
                />
                <Text
                  className={cn('min-w-0 flex-1 text-sm', notification.read ? '' : 'font-semibold')}
                  numberOfLines={1}>
                  {notification.title}
                </Text>
                {!notification.read ? (
                  <View className="bg-primary size-2 rounded-full" />
                ) : null}
              </View>
              <Text variant="muted" className="text-sm">
                {notification.body}
              </Text>
              <Text variant="muted" className="text-xs">
                {relativeTime(notification.created_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
