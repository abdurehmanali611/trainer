import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as React from 'react';

import { registerPushToken, routeForNotification, unregisterPushToken } from '@/lib/push';

/**
 * Registers the device for push notifications while the trainer is signed in
 * and routes tapped notifications (background/quit or banner taps) into the
 * app via expo-router. No-ops on web.
 */
export function usePushNotifications(enabled: boolean): void {
  const router = useRouter();

  // Register / unregister with the backend as the auth state flips.
  React.useEffect(() => {
    if (enabled) {
      void registerPushToken();
    } else {
      void unregisterPushToken();
    }
  }, [enabled]);

  // A notification tapped while the app was backgrounded or fully closed.
  const initialResponse = Notifications.useLastNotificationResponse();
  React.useEffect(() => {
    const response = initialResponse;
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const route = routeForNotification(
      response.notification.request.content.data as Record<string, unknown> | undefined
    );
    if (route) router.push(route as never);
  }, [initialResponse, router]);

  // A notification tapped while the app was in the foreground.
  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForNotification(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
      if (route) router.push(route as never);
    });
    return () => subscription.remove();
  }, [router]);
}
