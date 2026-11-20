import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Pressable, View } from 'react-native';
import {
  BadgeCheckIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  LayoutDashboardIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react-native';

import { alpha, COLORS } from '@/components/kit';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Visible bottom tabs, in order. Everything else renders no tab button. */
const TAB_ITEMS: { name: string; label: string; icon: LucideIcon; color: string }[] = [
  { name: 'index', label: 'Home', icon: LayoutDashboardIcon, color: COLORS.green },
  { name: 'clients', label: 'Clients', icon: UsersIcon, color: COLORS.cyan },
  { name: 'plans', label: 'Plans', icon: DumbbellIcon, color: COLORS.violet },
  { name: 'schedule', label: 'Schedule', icon: CalendarDaysIcon, color: COLORS.amber },
  { name: 'remark', label: 'Remark', icon: BadgeCheckIcon, color: COLORS.pink },
];

// Moved into the top-right header menu instead of the bottom tab bar.
const MENU_MOVED_TABS = new Set(['exercises', 'billing']);

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
  const untinted = '#64748B';

  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-stretch justify-around border-t pt-2"
      style={{
        backgroundColor: '#0B1220',
        borderTopColor: alpha(COLORS.green, 0.16),
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
        paddingBottom: Math.max(insets.bottom, 8),
      }}>
      {state.routes.map((route, index) => {
        if (HIDDEN_ROUTES.has(route.name) || MENU_MOVED_TABS.has(route.name)) return null;

        const item = TAB_ITEMS.find((tab) => tab.name === route.name);
        if (!item) return null;

        const focused = state.index === index;
        const label = descriptors[route.key]?.options?.title ?? item.label;
        const color = focused ? item.color : untinted;

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
            className="flex-1 items-center justify-center gap-1"
            style={{ flex: 1, flexGrow: 1, flexBasis: 0, minWidth: 0 }}
            testID={`tab-${route.name}`}>
            <View
              className="items-center justify-center rounded-2xl px-4 py-1.5"
              style={
                focused
                  ? { backgroundColor: alpha(item.color, 0.16), borderWidth: 1, borderColor: alpha(item.color, 0.35) }
                  : { borderWidth: 1, borderColor: 'transparent' }
              }>
              <Icon as={item.icon} size={22} color={color} />
            </View>
            <Text
              numberOfLines={1}
              style={{
                color,
                fontSize: 11,
                fontWeight: focused ? '800' : '600',
                letterSpacing: 0.2,
              }}>
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
      <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarButton: () => null }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="remark" options={{ title: 'Remark' }} />
      <Tabs.Screen name="billing" options={{ title: 'Billing', tabBarButton: () => null }} />
      {/* Nested routes that keep the tab bar visible but are not tab items */}
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarButton: () => null }} />
      <Tabs.Screen name="client" options={{ title: 'Client', tabBarButton: () => null }} />
      <Tabs.Screen name="support-chat" options={{ title: 'Support', tabBarButton: () => null }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarButton: () => null }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarButton: () => null }} />
    </Tabs>
  );
}
