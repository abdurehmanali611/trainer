import { Alert, Platform } from 'react-native';

import { isWebAlertReady, showWebAlert } from '@/lib/web-alert';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Cross-platform confirmation.
 *
 * react-native-web ships `Alert.alert` as an empty stub (`static alert() {}`),
 * so on web the callback of an Alert-based confirm never runs — actions wired
 * through it silently do nothing in the browser. This helper uses the native
 * Alert on iOS/Android and `window.confirm` on web, and resolves to whether
 * the user confirmed.
 */
export function confirmAction({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Prefer the styled in-app dialog (the web Alert host) so sign-out matches
    // the rest of the app; fall back to window.confirm if it isn't mounted.
    if (isWebAlertReady()) {
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        showWebAlert({
          title,
          message,
          buttons: [
            { text: cancelLabel, style: 'cancel', onPress: () => done(false) },
            {
              text: confirmLabel,
              style: destructive ? 'destructive' : 'default',
              onPress: () => done(true),
            },
          ],
          onDismiss: () => done(false),
        });
      });
    }
    const ok =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(`${title}\n\n${message}`)
        : false;
    return Promise.resolve(ok);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
