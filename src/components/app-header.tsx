import { useRouter } from 'expo-router';
import {
  BellIcon,
  ChevronLeftIcon,
  LifeBuoyIcon,
  LogOutIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  Settings2Icon,
  UserIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useUnreadChatCount } from '@/hooks/use-unread-chat';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { relativeTime } from '@/lib/dates';
import type { AppNotification } from '@/lib/types';

function IconButton({
  onPress,
  dot,
  label,
  children,
}: {
  onPress: () => void;
  dot?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Button
        size="icon"
        variant="outline"
        className="h-10 w-10 rounded-full border-border/80 bg-card"
        onPress={onPress}
        accessibilityLabel={label}>
        {children}
      </Button>
      {dot ? (
        <View className="pointer-events-none absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
      ) : null}
    </View>
  );
}

export function AppHeader() {
  const router = useRouter();
  const { trainer, signOut } = useAuth();
  const chatUnread = useUnreadChatCount();

  const [notifItems, setNotifItems] = React.useState<AppNotification[]>([]);
  const [notifUnread, setNotifUnread] = React.useState(0);
  const [notifLoading, setNotifLoading] = React.useState(false);

  const loadNotifications = React.useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await api<{ unread: number; results: AppNotification[] }>('notifications/');
      setNotifItems(res.results);
      setNotifUnread(res.unread);
    } catch {
      setNotifItems([]);
      setNotifUnread(0);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function markRead(notification: AppNotification) {
    if (notification.read) return;
    setNotifItems((list) => list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    setNotifUnread((count) => Math.max(0, count - 1));
    try {
      await api(`notifications/${notification.id}/read/`, { method: 'POST', body: {} });
    } catch {
      setNotifItems((list) =>
        list.map((n) => (n.id === notification.id ? { ...n, read: false } : n))
      );
      setNotifUnread((count) => count + 1);
    }
  }

  async function markAllRead() {
    const first = notifItems[0];
    if (!first || notifUnread === 0) return;
    const previous = notifItems;
    setNotifItems((list) => list.map((n) => ({ ...n, read: true })));
    setNotifUnread(0);
    try {
      await api(`notifications/${first.id}/read/`, { method: 'POST', body: { all: true } });
    } catch {
      setNotifItems(previous);
      setNotifUnread(previous.filter((n) => !n.read).length);
    }
  }

  function confirmSignOut() {
    const run = async () => {
      const ok = await confirmAction({
        title: 'Sign out?',
        message: 'You will need to sign in again to access the app.',
        confirmLabel: 'Sign out',
      });
      if (!ok) return;
      try {
        await signOut();
      } finally {
        router.replace('/auth/login');
      }
    };

    if (Platform.OS === 'web') {
      void run();
      return;
    }
    // Delay until the dropdown overlay has closed, otherwise the dialog can
    // be swallowed by the menu's FullWindowOverlay on native.
    setTimeout(() => void run(), 250);
  }

  const initials =
    trainer?.full_name
      ?.split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'T';

  return (
    <View className="mb-9 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
        <View className={`relative ${router.canGoBack() ? 'ml-9' : ''}`}>
          <Avatar
            alt={trainer?.full_name || 'Trainer'}
            accessibilityLabel={trainer?.full_name || 'Trainer'}
            className="h-10 w-10 items-center justify-center bg-primary/10 ring-1 ring-primary/20">
            {trainer?.avatar_url ? <AvatarImage source={{ uri: trainer.avatar_url }} /> : null}
            <AvatarFallback>
              <Text className="text-xs font-bold text-primary">{initials}</Text>
            </AvatarFallback>
          </Avatar>
          {router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityLabel="Go back"
              className="absolute -left-9 top-1.5 z-10 h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card shadow-sm active:opacity-70">
              <Icon as={ChevronLeftIcon} size={16} />
            </Pressable>
          ) : null}
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="h4" numberOfLines={1} className="text-lg">
            {trainer?.full_name || 'Trainer'}
          </Text>
          {trainer?.gym_name ? (
            <Text variant="muted" className="text-xs" numberOfLines={1}>
              {trainer.gym_name}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <IconButton label="Open chats" dot={chatUnread > 0} onPress={() => router.push('/chat')}>
          <Icon as={MessageCircleIcon} size={18} />
        </IconButton>

        <DropdownMenu onOpenChange={(open) => open && void loadNotifications()}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="relative h-10 w-10 rounded-full border-border/80 bg-card"
              accessibilityLabel="Open notifications">
              <Icon as={BellIcon} size={18} />
              {notifUnread > 0 ? (
                <View className="pointer-events-none absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <View className="flex-row items-center justify-between px-2 py-1.5">
              <Text className="text-sm font-semibold">Notifications</Text>
              <Pressable
                disabled={notifUnread === 0}
                onPress={() => void markAllRead()}
                hitSlop={8}
                className={notifUnread === 0 ? 'opacity-40' : 'active:opacity-60'}>
                <Text className="text-xs font-medium text-primary">Mark all read</Text>
              </Pressable>
            </View>
            <DropdownMenuSeparator />
            {notifLoading && notifItems.length === 0 ? (
              <Text variant="muted" className="px-2 py-3 text-xs">
                Loading notifications…
              </Text>
            ) : notifItems.length === 0 ? (
              <Text variant="muted" className="px-2 py-3 text-xs">
                No notifications yet. Bookings, payments and requests appear here.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <View className="gap-1 py-1">
                  {notifItems.map((notification) => (
                    <Pressable
                      key={notification.id}
                      onPress={() => void markRead(notification)}
                      className={
                        'gap-1 rounded-lg px-2 py-2 active:bg-accent ' +
                        (notification.read ? '' : 'bg-accent/50')
                      }>
                      <View className="flex-row items-center gap-2">
                        {!notification.read ? (
                          <View className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
                        ) : null}
                        <Text
                          className={
                            'min-w-0 flex-1 text-sm ' + (notification.read ? '' : 'font-semibold')
                          }
                          numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {relativeTime(notification.created_at)}
                        </Text>
                      </View>
                      <Text variant="muted" className="text-xs" numberOfLines={2}>
                        {notification.body}
                      </Text>
                      {!notification.read ? (
                        <Pressable
                          onPress={() => void markRead(notification)}
                          hitSlop={8}
                          className="self-start active:opacity-60">
                          <Text className="text-xs font-medium text-primary">Mark as read</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10 rounded-full border-border/80 bg-card"
              accessibilityLabel="Open menu">
              <Icon as={Settings2Icon} size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <Text variant="muted" className="text-xs font-semibold uppercase tracking-wide">
                {trainer?.username || 'Account'}
              </Text>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onPress={() => router.push('/more/profile')}>
              <Icon as={UserIcon} size={16} />
              <Text>Profile</Text>
            </DropdownMenuItem>
            <DropdownMenuItem onPress={() => router.push('/more/diary-review')}>
              <Icon as={NotebookPenIcon} size={16} />
              <Text>Diary review</Text>
            </DropdownMenuItem>
            <DropdownMenuItem onPress={() => router.push('/support-chat')}>
              <Icon as={LifeBuoyIcon} size={16} />
              <Text>Support chat</Text>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onPress={confirmSignOut}>
              <Icon as={LogOutIcon} size={16} />
              <Text>Sign out</Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
    </View>
  );
}
