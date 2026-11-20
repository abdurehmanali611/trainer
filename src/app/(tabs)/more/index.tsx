import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import {
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

import { Gradient, powerGradient } from '@/components/gradient';
import { alpha, COLORS, IconBubble, Panel } from '@/components/kit';
import { Screen, ScreenHeader } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { initials } from '@/lib/format';

type MenuRow = {
  key: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  href: Href;
};

const ROWS: MenuRow[] = [
  {
    key: 'payment-instructions',
    label: 'Payment instructions',
    subtitle: 'Telebirr, bank and cash details',
    icon: WalletIcon,
    color: COLORS.green,
    href: '/more/payment-instructions',
  },
  {
    key: 'diary-review',
    label: 'Diary review',
    subtitle: 'Review client food diaries',
    icon: NotebookPenIcon,
    color: COLORS.orange,
    href: '/more/diary-review',
  },
  {
    key: 'support-chat',
    label: 'Support chat',
    subtitle: 'Talk to the admin team',
    icon: LifeBuoyIcon,
    color: COLORS.cyan,
    href: '/support-chat',
  },
  {
    key: 'profile',
    label: 'Profile',
    subtitle: 'Your details and settings',
    icon: CircleUserIcon,
    color: COLORS.violet,
    href: '/more/profile',
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { trainer, signOut } = useAuth();
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

  const name = trainer?.full_name?.trim() || trainer?.username || 'Trainer';

  return (
    <Screen>
      <ScreenHeader title="More" />

      <Gradient colors={powerGradient} style={{ borderRadius: 28, overflow: 'hidden', marginBottom: 16 }}>
        <View className="flex-row items-center gap-4 p-5">
          {trainer?.avatar_url ? (
            <Image
              source={{ uri: trainer.avatar_url }}
              style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.25)',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.5)',
              }}>
              <Text className="text-xl font-black text-white">{initials(name) || '?'}</Text>
            </View>
          )}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-xl font-black tracking-tight text-white" numberOfLines={1}>
              {name}
            </Text>
            {trainer?.gym_name ? (
              <Text className="text-xs font-semibold text-white/80" numberOfLines={1}>
                {trainer.gym_name}
              </Text>
            ) : null}
            {trainer?.username ? (
              <Text className="text-xs font-medium text-white/65" numberOfLines={1}>
                @{trainer.username}
              </Text>
            ) : null}
          </View>
        </View>
      </Gradient>

      <Panel className="gap-1 p-2">
        {ROWS.map((row) => (
          <Pressable
            key={row.key}
            onPress={() => router.push(row.href)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-2xl px-2 py-2.5 active:opacity-70">
            <IconBubble icon={row.icon} color={row.color} size={40} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-[15px] font-bold">{row.label}</Text>
              <Text variant="muted" className="text-xs" numberOfLines={1}>
                {row.subtitle}
              </Text>
            </View>
            <Icon as={ChevronRightIcon} size={18} color={COLORS.muted} />
          </Pressable>
        ))}
      </Panel>

      <Pressable
        onPress={confirmSignOut}
        accessibilityRole="button"
        className="mt-5 h-12 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80"
        style={{ backgroundColor: alpha(COLORS.rose, 0.12), borderWidth: 1, borderColor: alpha(COLORS.rose, 0.4) }}>
        <Icon as={LogOutIcon} size={18} color={COLORS.rose} />
        <Text className="text-sm font-bold" style={{ color: COLORS.rose }}>
          Sign out
        </Text>
      </Pressable>
    </Screen>
  );
}
