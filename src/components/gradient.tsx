import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

/** Electric cyan → lime — athletic Trainer OS brand */
export const brandGradient = ['#06B6D4', '#22C55E'] as const;
export const powerGradient = ['#0EA5E9', '#84CC16'] as const;
export const deepGradient = ['#0F172A', '#0E7490'] as const;
export const sunriseGradient = ['#F59E0B', '#EF4444'] as const;
export const freshGradient = ['#06B6D4', '#10B981'] as const;

type GradientColors = readonly [string, string, ...string[]];

type GradientProps = Omit<LinearGradientProps, 'colors'> & { colors?: GradientColors };

export function Gradient({ colors = brandGradient, start, end, style, ...props }: GradientProps) {
  return (
    <LinearGradient
      colors={colors as unknown as LinearGradientProps['colors']}
      start={start ?? { x: 0, y: 0 }}
      end={end ?? { x: 1, y: 1 }}
      style={style}
      {...props}
    />
  );
}

export function HeroCard({
  colors = powerGradient,
  className,
  children,
  ...props
}: Omit<GradientProps, 'style'> & { className?: string; children?: React.ReactNode }) {
  return (
    <Gradient colors={colors} style={{ borderRadius: 28, overflow: 'hidden' }} {...props}>
      <View className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/15" />
      <View className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-black/10" />
      <View className="absolute right-8 bottom-6 h-16 w-16 rounded-full bg-white/10" />
      <View className={cn('relative p-5', className)}>{children}</View>
    </Gradient>
  );
}
