import { cn } from '@/lib/utils';
import * as React from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type WebAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'plainText' | undefined;
};

type WebAlertDialog = {
  key: number;
  title: string;
  message?: string | undefined;
  buttons: WebAlertButton[];
  onDismiss?: (() => void) | undefined;
};

let seq = 0;
let queue: WebAlertDialog[] = [];
let current: WebAlertDialog | null = null;
let listener: ((dialog: WebAlertDialog | null) => void) | null = null;

function notify() {
  listener?.(current);
}

function pump() {
  if (current || queue.length === 0) return;
  current = queue.shift() ?? null;
  notify();
}

function closeDialog() {
  const dialog = current;
  current = null;
  notify();
  dialog?.onDismiss?.();
  pump();
}

/** True once the web alert host is mounted and can display dialogs. */
export function isWebAlertReady(): boolean {
  return Platform.OS === 'web' && listener !== null;
}

/**
 * Replaces `Alert.alert` on web.
 *
 * react-native-web ships `Alert.alert` as an empty stub, so all 70+ alerts in
 * this app (confirmations, errors, success toasts) silently did nothing in the
 * browser. Installing one patched implementation here makes every existing
 * call site work on web with a styled in-app dialog; native keeps the real
 * system alert untouched.
 */
function installWebAlert() {
  if (Platform.OS !== 'web') return;
  const target = Alert as unknown as {
    alert: (
      title: string,
      message?: string,
      buttons?: WebAlertButton[],
      options?: 'none' | 'default' | { onDismiss?: () => void } | undefined
    ) => void;
  };
  target.alert = (title, message, buttons, options) => {
    showWebAlert({
      title: String(title),
      message: typeof message === 'string' ? message : undefined,
      buttons: buttons?.length ? buttons : [{ text: 'OK', style: 'default' }],
      onDismiss: typeof options === 'object' ? options?.onDismiss : undefined,
    });
  };
}

/** Queue a dialog for display by {@link WebAlertHost}. */
export function showWebAlert(dialog: Omit<WebAlertDialog, 'key'>): void {
  queue.push({ ...dialog, key: ++seq });
  pump();
}

installWebAlert();

/**
 * Mount once near the root of the app. Renders the queued dialogs as a modal
 * overlay styled like the rest of the design system.
 */
export function WebAlertHost() {
  const [dialog, setDialog] = React.useState<WebAlertDialog | null>(current);

  React.useEffect(() => {
    listener = setDialog;
    // Show anything that was queued before this host mounted.
    if (current) setDialog(current);
    return () => {
      if (listener === setDialog) listener = null;
    };
  }, []);

  if (!dialog) return null;

  const isSingle = dialog.buttons.length === 1;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeDialog}>
      <View className="flex-1 items-center justify-center bg-black/55 px-6">
        <Pressable
          onPress={closeDialog}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View className="w-full max-w-[420px] gap-4 rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-black/40 dark:shadow-black/70">
          <View className="gap-1.5">
            <Text className="text-base font-bold text-foreground">{dialog.title}</Text>
            {dialog.message ? (
              <Text variant="muted" className="text-sm leading-6">
                {dialog.message}
              </Text>
            ) : null}
          </View>
          <View className={cn('flex-row gap-2', isSingle && 'flex-col-reverse')}>
            {dialog.buttons.map((button, index) => (
              <Button
                key={`${dialog.key}-${index}`}
                variant={
                  button.style === 'cancel'
                    ? 'outline'
                    : button.style === 'destructive'
                      ? 'destructive'
                      : 'default'
                }
                className={cn('flex-1 rounded-xl', isSingle && 'w-full')}
                onPress={() => {
                  button.onPress?.();
                  closeDialog();
                }}>
                <Text className="text-sm font-semibold">{button.text ?? 'OK'}</Text>
              </Button>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
