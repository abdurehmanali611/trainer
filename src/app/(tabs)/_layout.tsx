import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Pressable, useColorScheme, View } from 'react-native';
import {
  CalendarDaysIcon,
  CreditCardIcon,
  DumbbellIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Visible bottom tabs, in order. Everything else renders no tab button. */
const TAB_ITEMS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Home', icon: LayoutDashboardIcon },
  { name: 'clients', label: 'Clients', icon: UsersIcon },
  { name: 'plans', label: 'Plans', icon: DumbbellIcon },
  { name: 'exercises', label: 'Exercise', icon: ListChecksIcon },
  { name: 'schedule', label: 'Schedule', icon: CalendarDaysIcon },
  { name: 'billing', label: 'Billing', icon: CreditCardIcon },
];

/** Nested routes that keep the tab bar visible but show no button. */
const HIDDEN_ROUTES = new Set(['chat', 'client', 'support-chat', 'more', 'plan']);



/**
 * Custom bottom bar.
 *
 * Replaces expo-router's built-in bar entirely: this version of its
 * bottom-tabs ignores sceneContainerStyle/tabBarButtonStyle, so instead of
 * fighting it we render our own row. The bar is `width: 100%` +
 * `alignSelf: stretch` and every button is `flex: 1`, so the items always
 * spread evenly across the whole screen width — never hugging the left edge.
 */
function TrainerTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const tint = dark ? '#A5B4FC' : '#4F46E5';
  const untinted = dark ? '#64748B' : '#94A3B8';

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-stretch justify-around border-t border-[#E8EBF3] bg-white pt-1.5 dark:border-[#263248] dark:bg-[#131A2E]"
      style={{
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
        paddingBottom: Math.max(insets.bottom, 8),
      }}>
      {state.routes.map((route, index) => {
        if (HIDDEN_ROUTES.has(route.name)) return null;

        const item = TAB_ITEMS.find((tab) => tab.name === route.name);
        if (!item) return null;

        const focused = state.index === index;
        const label = descriptors[route.key]?.options?.title ?? item.label;
        const color = focused ? tint : untinted;

        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        const onLongPress = () => {
          emitter.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            className="flex-1 items-center justify-center gap-0.5"
            style={{ flex: 1, flexGrow: 1, flexBasis: 0, minWidth: 0 }}
            testID={`tab-${route.name}`}>
            <Icon
              as={item.icon}
              size={22}
              color={color}
              className={focused ? 'text-primary' : 'text-muted-foreground'}
            />
            <Text
              numberOfLines={1}
              style={{ color, fontSize: 11, fontWeight: '600', letterSpacing: 0.1 }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TrainerTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans' }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing' }} />
      {/* Nested routes that keep the tab bar visible but are not tab items */}
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarButton: () => null }} />
      <Tabs.Screen name="client" options={{ title: 'Client', tabBarButton: () => null }} />
      <Tabs.Screen name="support-chat" options={{ title: 'Support', tabBarButton: () => null }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarButton: () => null }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarButton: () => null }} />
    </Tabs>
  );
}
