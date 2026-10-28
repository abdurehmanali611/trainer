import { LinearGradient, type LinearGradientProps } from 'expo-linear-gradient';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

export const brandGradient = ['#4F46E5', '#7C3AED'] as const;
export const sunriseGradient = ['#F59E0B', '#EC4899'] as const;
export const freshGradient = ['#0EA5E9', '#10B981'] as const;

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
  colors,
  className,
  children,
  ...props
}: Omit<GradientProps, 'style'> & { className?: string; children?: React.ReactNode }) {
  return (
    <Gradient colors={colors} style={{ borderRadius: 24, overflow: 'hidden' }} {...props}>
      <View className={cn('p-5', className)}>{children}</View>
    </Gradient>
  );
}
