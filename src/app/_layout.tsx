import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { WebAlertHost } from '@/lib/web-alert';
import { useInAppNotifications } from '@/hooks/use-in-app-notifications';
import { NotificationBanner } from '@/components/notification-banner';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, platform, refreshPlatform } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { latest, dismiss } = useInAppNotifications(status === 'signedIn');
  const [dismissedNotices, setDismissedNotices] = React.useState<string[]>([]);

  const inAuthGroup = segments[0] === 'auth';
  const inPlatformLock = segments[0] === 'platform-lock';

  const platformNotice = inPlatformLock
    ? null
    : (platform?.notices.find((n) => !dismissedNotices.includes(n.id)) ?? null);
  const banner =
    latest ??
    (platformNotice
      ? {
          id: platformNotice.id,
          title: platformNotice.title,
          body: platformNotice.message,
          type: 'payment' as const,
        }
      : null);

  const dismissBanner = React.useCallback(() => {
    if (latest) {
      dismiss();
      return;
    }
    if (platformNotice) {
      setDismissedNotices((prev) => [...prev, platformNotice.id]);
    }
  }, [latest, dismiss, platformNotice]);

  React.useEffect(() => {
    if (status !== 'signedIn') return;
    const interval = setInterval(() => {
      void refreshPlatform();
    }, 300_000);
    return () => clearInterval(interval);
  }, [status, refreshPlatform]);

  React.useEffect(() => {
    if (status === 'loading') return;
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/auth/login');
      return;
    }
    if (status === 'signedIn') {
      if (inAuthGroup) {
        if (platform && !platform.allowed) {
          router.replace('/platform-lock');
        } else {
          router.replace('/');
        }
        return;
      }
      if (platform && !platform.allowed && !inPlatformLock) {
        router.replace('/platform-lock');
        return;
      }
      if (platform && platform.allowed && inPlatformLock) {
        router.replace('/');
      }
    }
  }, [status, inAuthGroup, inPlatformLock, segments, router, platform]);

  React.useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="platform-lock" />
      </Stack>
      <NotificationBanner
        notification={banner}
        onPress={() => {
          const fromNotice = latest === null && platformNotice !== null;
          dismissBanner();
          router.push(fromNotice ? '/billing' : '/more/notifications');
        }}
        onDismiss={dismissBanner}
      />
      <PortalHost />
      {/* Makes Alert.alert work on web (native Alert is a no-op there). */}
      <WebAlertHost />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
