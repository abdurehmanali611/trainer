import type { LucideIcon } from 'lucide-react-native';
import { ChevronRightIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Accent palette used to colour features (hex so it works on native SVG too). */
export const COLORS = {
  green: '#3ADD6C',
  lime: '#A3E635',
  cyan: '#22D3EE',
  sky: '#38BDF8',
  violet: '#A78BFA',
  pink: '#F472B6',
  amber: '#FBBF24',
  orange: '#FB923C',
  rose: '#FB7185',
  red: '#F87171',
  emerald: '#34D399',
  muted: '#94A3B8',
} as const;

/** `#RRGGBB` + alpha (0–1) -> `rgba(...)`. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Rounded card, optionally tinted with a feature colour and tappable. */
export function Panel({
  tint,
  onPress,
  className,
  style,
  children,
}: {
  tint?: string;
  onPress?: () => void;
  className?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  const tinted: ViewStyle | undefined = tint
    ? { backgroundColor: alpha(tint, 0.09), borderColor: alpha(tint, 0.3) }
    : undefined;
  const classes = cn('overflow-hidden rounded-3xl border border-border bg-card p-4', className);
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cn(classes, 'active:opacity-80')} style={[tinted, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={classes} style={[tinted, style]}>
      {children}
    </View>
  );
}

/** Coloured rounded square holding an icon. */
export function IconBubble({
  icon,
  color = COLORS.green,
  size = 40,
  iconSize,
}: {
  icon: LucideIcon;
  color?: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: alpha(color, 0.16),
        borderWidth: 1,
        borderColor: alpha(color, 0.35),
      }}>
      <Icon as={icon} size={iconSize ?? Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/** Section title with an optional "See all" style action. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon,
  color = COLORS.green,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  color?: string;
}) {
  return (
    <View className="mb-3 mt-1 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
        {icon ? <IconBubble icon={icon} color={color} size={30} /> : null}
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold tracking-tight">{title}</Text>
          {subtitle ? (
            <Text variant="muted" className="text-xs">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          className="flex-row items-center gap-0.5 active:opacity-70">
          <Text className="text-xs font-semibold" style={{ color }}>
            {actionLabel}
          </Text>
          <Icon as={ChevronRightIcon} size={14} color={color} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small coloured stat: icon bubble, big value, label. */
export function StatTile({
  icon,
  label,
  value,
  hint,
  color = COLORS.green,
  onPress,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  color?: string;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <Panel tint={color} onPress={onPress} className={cn('gap-2.5 p-3.5', className)}>
      <IconBubble icon={icon} color={color} size={34} />
      <View className="gap-0.5">
        <Text className="text-xl font-black tracking-tight" numberOfLines={1}>
          {value}
        </Text>
        <Text variant="muted" className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </Text>
        {hint ? (
          <Text className="text-[11px]" style={{ color }} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Panel>
  );
}

/** Circular progress ring (0–1) with centred content. */
export function Ring({
  size = 96,
  stroke = 10,
  progress,
  color = COLORS.green,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={alpha(color, 0.18)}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Thin horizontal progress bar (0–1). */
export function Bar({
  value,
  color = COLORS.green,
  height = 8,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      style={{
        height,
        borderRadius: height,
        backgroundColor: alpha(color, 0.18),
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Smooth-ish line chart for a short series, with a soft fill. */
export function Sparkline({
  data,
  color = COLORS.green,
  width = 140,
  height = 48,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${height} L${pts[0].x.toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last.x} cy={last.y} r={4} fill={color} />
      <Circle cx={last.x} cy={last.y} r={8} fill={alpha(color, 0.25)} />
    </Svg>
  );
}

/** Pill-shaped segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row gap-1.5 rounded-2xl border border-border bg-card p-1.5">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cn(
              'h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-80',
              active ? 'bg-primary' : ''
            )}>
            {option.icon ? (
              <Icon as={option.icon} size={15} color={active ? '#04110A' : COLORS.muted} />
            ) : null}
            <Text
              className={cn(
                'text-[13px] font-bold',
                active ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
              numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small coloured label. */
export function Chip({
  label,
  color = COLORS.green,
  icon,
}: {
  label: string;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: alpha(color, 0.16), borderWidth: 1, borderColor: alpha(color, 0.3) }}>
      {icon ? <Icon as={icon} size={12} color={color} /> : null}
      <Text className="text-[11px] font-bold" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
