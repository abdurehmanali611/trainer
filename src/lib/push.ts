import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

const TOKEN_KEY = 'trainer.pushToken';

/**
 * Push notification registration and tap routing.
 *
 * Only meaningful on native — web has no Expo push token. The Expo push token
 * is registered with the backend (`POST /api/devices/`) whenever the
 * signed-in trainer's token changes. The backend's `PushToken` row is keyed
 * per trainer, so any new device replaces the previous one, and the backend
 * pushes via Expo whenever it creates a Notification.
 */

// How notifications behave while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null; // push needs a physical device

  const settings = await Notifications.getPermissionsAsync();
  // iOS provisional ≈ status 2; avoid IosAuthorizationStatus enum (lint/types gap).
  const granted = settings.granted || (settings.ios?.status ?? 0) >= 2;
  if (!granted) {
    const request = await Notifications.requestPermissionsAsync();
    if (!request.granted) return null;
  }

  try {
    const projectId = (
      Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
    )?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Register the device for push while signed in. Silently no-ops on web,
 * emulators, denied permission, or backend errors — the app polls
 * notifications as a fallback anyway.
 */
export async function registerPushToken(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;

  const previous = await AsyncStorage.getItem(TOKEN_KEY);
  if (previous === token) return;

  await api('devices/', {
    method: 'POST',
    body: { token },
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/**
 * Forget the locally cached token after sign-out. The backend keeps the
 * registration (there is no unregister endpoint) — re-registering from any
 * device overwrites it, and stale tokens expire on their own.
 */
export async function unregisterPushToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Where a tapped push notification should take the trainer. Notifications
 * carry an optional `data.route` (e.g. `/chat/12`); fall back to sensible
 * defaults by notification type.
 */
export function routeForNotification(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;
  if (typeof data.route === 'string' && data.route.startsWith('/')) return data.route;
  if (data.chat_id != null) return `/chat/${data.chat_id}`;
  if (data.client_id != null) return `/(tabs)/client/${data.client_id}`;
  if (data.payment_id != null) return '/(tabs)/billing';
  if (data.reschedule_request_id != null) return '/(tabs)/schedule';
  return null;
}
