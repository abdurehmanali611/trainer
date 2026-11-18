import '../global.css';

import { PortalHost } from '@rn-primitives/portal';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Appearance, View } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { WebAlertHost } from '@/lib/web-alert';
import { useInAppNotifications } from '@/hooks/use-in-app-notifications';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { NotificationBanner } from '@/components/notification-banner';

// A render error in any screen shows Expo Router's "Try again" screen instead
// of closing the app (release builds have no other error boundary).
export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, platform, refreshPlatform } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { latest, dismiss } = useInAppNotifications(status === 'signedIn');
  usePushNotifications(status === 'signedIn');
  const [dismissedNotices, setDismissedNotices] = React.useState<string[]>([]);
  const splashHidden = React.useRef(false);

  // app.json sets userInterfaceStyle: dark; reinforce on native client only
  // (SSR/web render has no Appearance.setColorScheme).
  React.useEffect(() => {
    if (typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme('dark');
    }
  }, []);

  const hideSplash = React.useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    void SplashScreen.hideAsync();
  }, []);

  const inAuthGroup = segments[0] === 'auth';
  const inPlatformLock = segments[0] === 'platform-lock';

  // Features 16/17: subscription warnings (quarterly renewal window, trial
  // ending) surface in the Billing section only — never as a global/header
  // banner. Only critical notices (payment required / on hold) surface here,
  // and the platform gate redirects blocked states to the portal anyway.
  const platformNotice = inPlatformLock
    ? null
    : (platform?.notices.find(
        (n) => n.severity === 'critical' && !dismissedNotices.includes(n.id)
      ) ?? null);
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

  // Hide splash as soon as auth settles — and always within 2.5s so a hung
  // bootstrap can never leave users on a blank native splash (purple/navy).
  React.useEffect(() => {
    if (status !== 'loading') hideSplash();
  }, [status, hideSplash]);

  React.useEffect(() => {
    const failsafe = setTimeout(hideSplash, 2500);
    return () => clearTimeout(failsafe);
  }, [hideSplash]);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2DD4BF" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
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
