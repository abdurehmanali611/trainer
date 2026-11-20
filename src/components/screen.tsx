import * as React from 'react';
import { InboxIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { alpha, COLORS, IconBubble } from '@/components/kit';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
  topGap?: number;
  /** Hide the default AppHeader (screens with their own Stack header). */
  showHeader?: boolean;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  className,
  topGap = 0,
  showHeader = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = padded ? 'px-5' : '';
  const header = !showHeader
    ? null
    : padded
      ? <AppHeader />
      : <View className="px-5"><AppHeader /></View>;

  if (scroll) {
    return (
      <ScrollView
        className={cn('flex-1 bg-background', className)}
        contentContainerClassName={cn(padding, 'pb-12')}
        contentContainerStyle={{ paddingTop: insets.top + 8 + topGap }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
        {header}
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      className={cn('flex-1 bg-background', padding, className)}
      style={{ paddingTop: insets.top + 8 + topGap }}>
      {header}
      {children}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="mb-5 gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[30px] font-black tracking-tight">{title}</Text>
        {right}
      </View>
      {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background">
      <ActivityIndicator size="large" color={COLORS.green} />
      {label ? <Text variant="muted">{label}</Text> : null}
    </View>
  );
}

export function EmptyView({
  title,
  subtitle,
  action,
  icon = InboxIcon,
  color = COLORS.green,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  color?: string;
}) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-12">
      <IconBubble icon={icon} color={color} size={64} />
      <Text className="text-lg font-bold tracking-tight">{title}</Text>
      {subtitle ? (
        <Text variant="muted" className="text-center">
          {subtitle}
        </Text>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-16">
      <IconBubble icon={TriangleAlertIcon} color={COLORS.rose} size={64} />
      <Text className="text-lg font-bold tracking-tight">Something went wrong</Text>
      <Text variant="muted" className="text-center">
        {error}
      </Text>
      {onRetry ? (
        <Text
          variant="small"
          onPress={onRetry}
          className="mt-2 rounded-full px-5 py-2.5 font-bold"
          style={{ color: '#04110A', backgroundColor: COLORS.green, overflow: 'hidden' }}>
          Try again
        </Text>
      ) : null}
    </View>
  );
}

/** Small colored pill used for statuses (mode, invoice, session, etc.). */
export function Badge({
  label,
  tone = 'default',
  className,
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const colors: Record<string, string> = {
    default: COLORS.muted,
    success: COLORS.green,
    warning: COLORS.amber,
    danger: COLORS.rose,
    info: COLORS.sky,
  };
  const color = colors[tone] ?? COLORS.muted;
  return (
    <View
      className={cn('self-start rounded-full px-2.5 py-1', className)}
      style={{ backgroundColor: alpha(color, 0.16), borderWidth: 1, borderColor: alpha(color, 0.32) }}>
      <Text className="text-xs font-bold capitalize" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export const toneForMode: Record<string, 'success' | 'info' | 'default'> = {
  paid: 'success',
  trial: 'info',
  illustrative: 'default',
};

export const toneForInvoice: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  paid: 'success',
  pending: 'warning',
  overdue: 'danger',
  forgiven: 'default',
};

export const toneForSession: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  completed: 'success',
  canceled: 'default',
  no_show: 'danger',
  scheduled: 'info',
  approved: 'success',
  rescheduling: 'warning',
};

export const toneForRequest: Record<string, 'success' | 'danger' | 'warning'> = {
  approved: 'success',
  declined: 'danger',
  pending: 'warning',
};
