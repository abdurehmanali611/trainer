import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

/** Deep navy → teal — matches hotcol-style dark primary */
export const brandGradient = ['#134E4A', '#2DD4BF'] as const;
export const powerGradient = ['#0F172A', '#0F766E'] as const;
export const deepGradient = ['#0B1220', '#134E4A'] as const;
export const sunriseGradient = ['#B45309', '#F59E0B'] as const;
export const freshGradient = ['#0F766E', '#2DD4BF'] as const;

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
    <Gradient colors={colors} style={{ borderRadius: 16, overflow: 'hidden' }} {...props}>
      <View className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/10" />
      <View className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-black/20" />
      <View className={cn('relative p-5', className)}>{children}</View>
    </Gradient>
  );
}
