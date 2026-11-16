import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import * as React from 'react';

type IconProps = LucideProps & {
  as: LucideIcon;
};

/**
 * NativeWind v5's `globalClassNamePolyfill` only wraps React Native core
 * components — it does NOT cover react-native-svg (which lucide icons render
 * into), so `text-*` className colors are silently dropped on native while
 * working on web. Resolve the effective text class to a hex fallback so
 * icons keep their intended color on device. An explicit `color` prop always
 * wins, and on web the className still paints over the fallback (CSS rules
 * beat presentation attributes).
 *
 * Values mirror the theme tokens in `src/global.css`.
 */
const TEXT_CLASS_COLORS: Record<string, string> = {
  'text-background': '#0B111E',
  'text-foreground': '#EEF2F6',
  'text-muted-foreground': '#8F9CAE',
  'text-primary': '#2BD4BD',
  'text-primary-foreground': '#0B111E',
  'text-destructive': '#F26969',
  'text-success': '#2EB88A',
  'text-warning': '#FBBE23',
  'text-info': '#2BD4BD',
};

function colorFromClasses(classes: string): string | undefined {
  for (const token of classes.split(/\s+/)) {
    const hex = TEXT_CLASS_COLORS[token];
    if (hex) return hex;
  }
  return undefined;
}

function Icon({ as: IconComponent, className, size = 14, color, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  const classes = cn('text-foreground', textClass, className);
  return (
    <IconComponent
      className={classes}
      color={color ?? colorFromClasses(classes)}
      size={size}
      {...props}
    />
  );
}

export { Icon };
