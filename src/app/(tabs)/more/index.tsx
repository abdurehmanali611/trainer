import { useRouter, type Href } from 'expo-router';
import {
  BellIcon,
  ChevronRightIcon,
  CircleUserIcon,
  LifeBuoyIcon,
  LogOutIcon,
  NotebookPenIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';

type MenuRow = {
  key: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  href: Href;
};

const ROWS: MenuRow[] = [
  {
    key: 'notifications',
    label: 'Notifications',
    subtitle: 'Bookings, payments and requests',
    icon: BellIcon,
    href: '/more/notifications',
  },
  {
    key: 'payment-instructions',
    label: 'Payment instructions',
    subtitle: 'Telebirr, bank and cash details',
    icon: WalletIcon,
    href: '/more/payment-instructions',
  },
  {
    key: 'diary-review',
    label: 'Diary review',
    subtitle: 'Review client food diaries',
    icon: NotebookPenIcon,
    href: '/more/diary-review',
  },
  {
    key: 'support-chat',
    label: 'Support chat',
    subtitle: 'Talk to the admin team',
    icon: LifeBuoyIcon,
    href: '/support-chat',
  },
  {
    key: 'profile',
    label: 'Profile',
    subtitle: 'Your details and settings',
    icon: CircleUserIcon,
    href: '/more/profile',
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { trainer, signOut } = useAuth();
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    api<{ unread: number }>('notifications/')
      .then((res) => setUnread(res.unread))
      .catch(() => setUnread(0));
  }, []);

  function confirmSignOut() {
    void (async () => {
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
    })();
  }

  return (
    <Screen>
      <ScreenHeader title="More" />

      <View className="gap-1.5 rounded-2xl border border-border/70 bg-card p-2 shadow-sm shadow-black/[0.05] dark:shadow-black/30">
        {ROWS.map((row) => (
          <Pressable
            key={row.key}
            onPress={() => router.push(row.href)}
            className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent/50">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
              <Icon as={row.icon} size={18} className="text-primary" />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-sm font-medium">{row.label}</Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {row.subtitle}
              </Text>
            </View>
            {row.key === 'notifications' && unread > 0 ? (
              <View className="rounded-full bg-destructive px-2 py-0.5">
                <Text className="text-xs font-semibold text-white">{unread}</Text>
              </View>
            ) : null}
            <Icon as={ChevronRightIcon} size={16} className="text-muted-foreground" />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={confirmSignOut}
        className="mt-6 flex-row items-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3.5 active:bg-rose-500/10">
        <Icon as={LogOutIcon} size={20} className="text-destructive" />
        <Text className="text-sm font-semibold text-destructive">Sign out</Text>
      </Pressable>

      <Text variant="muted" className="mt-4 text-center text-xs">
        {[trainer?.full_name, trainer?.gym_name].filter(Boolean).join(' · ')}
      </Text>
    </Screen>
  );
}
