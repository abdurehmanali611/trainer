import { useRouter } from 'expo-router';
import {
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  InboxIcon,
  LifeBuoyIcon,
  ListChecksIcon,
  LogOutIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  Settings2Icon,
  TriangleAlertIcon,
  TrophyIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Gradient, powerGradient } from '@/components/gradient';
import { alpha, COLORS, IconBubble } from '@/components/kit';
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

const NOTIFICATION_STYLE: Record<AppNotification['type'], { icon: LucideIcon; color: string }> = {
  booking: { icon: CalendarClockIcon, color: COLORS.sky },
  payment: { icon: CreditCardIcon, color: COLORS.green },
  message: { icon: MessageSquareIcon, color: COLORS.cyan },
  alert: { icon: TriangleAlertIcon, color: COLORS.rose },
  achievement: { icon: TrophyIcon, color: COLORS.amber },
  request: { icon: InboxIcon, color: COLORS.violet },
};

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
        className="h-10 w-10 rounded-full"
        style={{ backgroundColor: alpha(COLORS.cyan, 0.12), borderColor: alpha(COLORS.cyan, 0.35) }}
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
          <Gradient colors={powerGradient} style={{ width: 46, height: 46, borderRadius: 23, padding: 2 }}>
            <Avatar
              alt={trainer?.full_name || 'Trainer'}
              accessibilityLabel={trainer?.full_name || 'Trainer'}
              className="h-full w-full items-center justify-center bg-card">
              {trainer?.avatar_url ? <AvatarImage source={{ uri: trainer.avatar_url }} /> : null}
              <AvatarFallback>
                <Text className="text-xs font-extrabold" style={{ color: COLORS.green }}>
                  {initials}
                </Text>
              </AvatarFallback>
            </Avatar>
          </Gradient>
          {router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityLabel="Go back"
              className="absolute -left-9 top-2 z-10 h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card shadow-sm active:opacity-70">
              <Icon as={ChevronLeftIcon} size={16} />
            </Pressable>
          ) : null}
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="h4" numberOfLines={1} className="text-base font-black">
            {trainer?.full_name || 'Trainer'}
          </Text>
          {trainer?.gym_name ? (
            <Text className="text-xs font-semibold" style={{ color: COLORS.lime }} numberOfLines={1}>
              {trainer.gym_name}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <IconButton label="Open chats" dot={chatUnread > 0} onPress={() => router.push('/chat')}>
          <Icon as={MessageCircleIcon} size={18} color={COLORS.cyan} />
        </IconButton>

        <DropdownMenu onOpenChange={(open) => open && void loadNotifications()}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="relative h-10 w-10 rounded-full"
              style={{ backgroundColor: alpha(COLORS.amber, 0.12), borderColor: alpha(COLORS.amber, 0.35) }}
              accessibilityLabel="Open notifications">
              <Icon as={BellIcon} size={18} color={COLORS.amber} />
              {notifUnread > 0 ? (
                <View className="pointer-events-none absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <View className="flex-row items-center justify-between px-2 py-1.5">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-black">Notifications</Text>
                {notifUnread > 0 ? (
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: COLORS.rose }}>
                    <Text className="text-[11px] font-black text-white">{notifUnread}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                disabled={notifUnread === 0}
                onPress={() => void markAllRead()}
                hitSlop={8}
                className={
                  notifUnread === 0
                    ? 'flex-row items-center gap-1 opacity-40'
                    : 'flex-row items-center gap-1 active:opacity-60'
                }>
                <Icon as={CheckCheckIcon} size={14} color={COLORS.green} />
                <Text className="text-xs font-bold" style={{ color: COLORS.green }}>
                  Mark all read
                </Text>
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
                  {notifItems.map((notification) => {
                    const style = NOTIFICATION_STYLE[notification.type] ?? {
                      icon: BellIcon,
                      color: COLORS.green,
                    };
                    return (
                      <Pressable
                        key={notification.id}
                        onPress={() => void markRead(notification)}
                        className="flex-row items-start gap-2.5 rounded-2xl px-2 py-2 active:opacity-70"
                        style={
                          notification.read
                            ? undefined
                            : { backgroundColor: alpha(style.color, 0.1) }
                        }>
                        <IconBubble icon={style.icon} color={style.color} size={34} />
                        <View className="min-w-0 flex-1 gap-0.5">
                          <View className="flex-row items-center gap-2">
                            <Text
                              className={
                                'min-w-0 flex-1 text-sm ' +
                                (notification.read ? 'font-semibold' : 'font-black')
                              }
                              numberOfLines={1}>
                              {notification.title}
                            </Text>
                            {!notification.read ? (
                              <View
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: style.color,
                                }}
                              />
                            ) : null}
                          </View>
                          <Text variant="muted" className="text-xs" numberOfLines={2}>
                            {notification.body}
                          </Text>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[11px] font-semibold" style={{ color: style.color }}>
                              {relativeTime(notification.created_at)}
                            </Text>
                            {!notification.read ? (
                              <Text className="text-[11px] font-bold" style={{ color: COLORS.green }}>
                                Tap to mark read
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
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
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: alpha(COLORS.violet, 0.12), borderColor: alpha(COLORS.violet, 0.35) }}
              accessibilityLabel="Open menu">
              <Icon as={Settings2Icon} size={18} color={COLORS.violet} />
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
            <DropdownMenuItem onPress={() => router.push('/(tabs)/exercises')}>
              <Icon as={ListChecksIcon} size={16} />
              <Text>Exercises</Text>
            </DropdownMenuItem>
            <DropdownMenuItem onPress={() => router.push('/(tabs)/billing')}>
              <Icon as={CreditCardIcon} size={16} />
              <Text>Billing</Text>
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
