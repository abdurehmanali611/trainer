import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Card section — hotcol/pharmacy style: quiet elevated surface, one title.
 */
export function Section({
  title,
  subtitle,
  action,
  className,
  children,
  ...props
}: ViewProps & {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <View
      className={cn(
        'gap-4 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/30',
        className
      )}
      {...props}>
      {title || action ? (
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            {title ? (
              <Text className="text-[15px] font-semibold text-foreground">{title}</Text>
            ) : null}
            {subtitle ? (
              <Text variant="muted" className="text-xs">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function FormPanel({
  title,
  subtitle,
  className,
  children,
  ...props
}: ViewProps & {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <Section title={title} subtitle={subtitle} className={cn('gap-3', className)} {...props}>
      {children}
    </Section>
  );
}

export function Surface({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('rounded-xl border border-border bg-card shadow-sm shadow-black/30', className)}
      {...props}
    />
  );
}

export function SurfacePressable({ className, ...props }: PressableProps) {
  return (
    <Pressable
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm shadow-black/30 active:bg-secondary',
        className
      )}
      {...props}
    />
  );
}

/** Metric tile — default quiet; only warning/danger tint when needed. */
export function StatTile({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'primary' | 'warning' | 'danger' | 'muted';
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: 'border-border bg-secondary',
    primary: 'border-border bg-secondary',
    muted: 'border-border bg-secondary/70',
    warning: 'border-warning/30 bg-warning/10',
    danger: 'border-destructive/30 bg-destructive/10',
  };
  return (
    <View className={cn('min-w-0 flex-1 gap-1.5 rounded-lg border p-3', tones[tone], className)}>
      <Text className="text-2xl font-semibold tabular-nums text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
