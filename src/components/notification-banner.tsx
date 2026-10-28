import { BellIcon, XIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { InAppNotification } from '@/hooks/use-in-app-notifications';

const AUTO_DISMISS_MS = 5_000;

export function NotificationBanner({
  notification,
  onPress,
  onDismiss,
}: {
  notification: InAppNotification | null;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      className="absolute inset-x-0 z-50 px-4"
      style={{ top: insets.top + 8 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="flex-row items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon as={BellIcon} size={17} className="text-foreground" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {notification.title}
          </Text>
          <Text variant="muted" className="text-sm" numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss notification" className="-m-1 p-1">
          <Icon as={XIcon} size={15} className="text-muted-foreground" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
