import * as React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
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
    <View className="mb-5 gap-1.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="h2" className="flex-1 text-[26px]">
          {title}
        </Text>
        {right}
      </View>
      {subtitle ? (
        <Text variant="muted" className="text-[13px]">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-background">
      <ActivityIndicator size="large" />
      {label ? <Text variant="muted">{label}</Text> : null}
    </View>
  );
}

export function EmptyView({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View className="items-center justify-center gap-2 py-16">
      <Text variant="h4">{title}</Text>
      {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center gap-3 py-16">
      <Text variant="h4">Something went wrong</Text>
      <Text variant="muted" className="text-center">
        {error}
      </Text>
      {onRetry ? (
        <Text variant="small" onPress={onRetry} className="text-primary mt-2 underline">
          Tap to retry
        </Text>
      ) : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'default',
  className,
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: 'bg-secondary text-secondary-foreground ring-secondary-foreground/10',
    success: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/25 dark:bg-emerald-500/15 dark:text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-700 ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-300',
    danger: 'bg-rose-500/10 text-rose-700 ring-rose-600/25 dark:bg-rose-500/15 dark:text-rose-300',
    info: 'bg-sky-500/10 text-sky-700 ring-sky-600/25 dark:bg-sky-500/15 dark:text-sky-300',
  };
  return (
    <View className={cn('self-start rounded-full px-2.5 py-1 ring-1 ring-inset', tones[tone], className)}>
      <Text className="text-xs font-semibold tracking-tight">{label}</Text>
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
};

export const toneForRequest: Record<string, 'success' | 'danger' | 'warning'> = {
  approved: 'success',
  declined: 'danger',
  pending: 'warning',
};
