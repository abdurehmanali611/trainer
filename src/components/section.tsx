import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { alpha, COLORS, IconBubble } from '@/components/kit';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Card section — rounded surface with a coloured accent (icon bubble or a slim
 * accent bar) next to the title. Pass `color` to tint the card for a feature.
 */
export function Section({
  title,
  subtitle,
  action,
  icon,
  color = COLORS.green,
  tinted = false,
  className,
  children,
  style,
  ...props
}: ViewProps & {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  color?: string;
  /** Tint the whole card with `color` instead of the neutral surface. */
  tinted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View
      className={cn('gap-4 rounded-3xl border border-border bg-card p-4', className)}
      style={[
        tinted ? { backgroundColor: alpha(color, 0.08), borderColor: alpha(color, 0.3) } : null,
        style,
      ]}
      {...props}>
      {title || action ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
            {icon ? (
              <IconBubble icon={icon} color={color} size={32} />
            ) : title ? (
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: color }} />
            ) : null}
            <View className="min-w-0 flex-1 gap-0.5">
              {title ? (
                <Text className="text-[15px] font-bold tracking-tight text-foreground">{title}</Text>
              ) : null}
              {subtitle ? (
                <Text variant="muted" className="text-xs">
                  {subtitle}
                </Text>
              ) : null}
            </View>
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
  return <View className={cn('rounded-3xl border border-border bg-card', className)} {...props} />;
}

export function SurfacePressable({ className, ...props }: PressableProps) {
  return (
    <Pressable
      className={cn('rounded-3xl border border-border bg-card active:opacity-80', className)}
      {...props}
    />
  );
}
