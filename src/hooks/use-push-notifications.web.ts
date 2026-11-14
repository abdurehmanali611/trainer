/**
 * Web no-op.
 *
 * Expo Notifications has no web push token or notification-response support
 * in this SDK (`useLastNotificationResponse` throws on web), so the native
 * implementation never loads here. The app already polls in-app
 * notifications as a fallback.
 */
export function usePushNotifications(_enabled?: boolean): void {}
