import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type SwipeRailProps = {
  /** `forward` renders the double chevron, `back` the single chevron. */
  direction: 'forward' | 'back';
  /** Caption rendered underneath, e.g. "Swipe to Diet". */
  label: string;
  onPress: () => void;
  /** Which of the two forward chevrons is currently lit. */
  lit?: 0 | 1;
  onLitChange?: (index: 0 | 1) => void;
  className?: string;
};

/**
 * Swipe rail used by the Plans and Schedule tabs to hop between their panels
 * (Workouts ↔ Diet, Sessions ↔ Requests).
 *
 * Forward mode renders two right chevrons where a light applies to one of them
 * at a time, with the destination written underneath; back mode renders a
 * single left chevron pinned to the right edge of the screen.
 */
export function SwipeRail({
  direction,
  label,
  onPress,
  lit = 0,
  onLitChange,
  className,
}: SwipeRailProps) {
  const forward = direction === 'forward';

  function press(index: 0 | 1) {
    onLitChange?.(index);
    onPress();
  }

  return (
    <View className={cn('items-end gap-1.5', className)}>
      <View className="flex-row items-center gap-2">
        {forward ? (
          ([0, 1] as const).map((index) => {
            const isLit = index === lit;
            return (
              <Pressable
                key={index}
                onPress={() => press(index)}
                accessibilityRole="button"
                accessibilityLabel={label}
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full border active:scale-90',
                  isLit
                    ? 'border-primary/50 bg-primary/15 shadow-sm shadow-primary/30'
                    : 'border-border bg-card dark:bg-card/60'
                )}>
                <Icon
                  as={ChevronRightIcon}
                  size={18}
                  className={isLit ? 'text-primary' : 'text-muted-foreground'}
                />
              </Pressable>
            );
          })
        ) : (
          <Pressable
            onPress={() => press(0)}
            accessibilityRole="button"
            accessibilityLabel={label}
            className="h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 active:scale-90">
            <Icon as={ChevronLeftIcon} size={18} className="text-primary" />
          </Pressable>
        )}
      </View>
      <Text className="text-[11px] font-medium text-primary/80" variant="muted">
        {label}
      </Text>
    </View>
  );
}
