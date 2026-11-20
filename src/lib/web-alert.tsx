import {
  CircleCheckIcon,
  CircleQuestionMarkIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'plainText' | undefined;
};

type AlertDialogState = {
  key: number;
  title: string;
  message?: string | undefined;
  buttons: AlertButton[];
  onDismiss?: (() => void) | undefined;
};

let seq = 0;
let queue: AlertDialogState[] = [];
let current: AlertDialogState | null = null;
let listener: ((dialog: AlertDialogState | null) => void) | null = null;

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

/** True once the alert host is mounted and can display dialogs. */
export function isWebAlertReady(): boolean {
  return listener !== null;
}

/** True while an alert dialog is currently on screen. */
export function isWebAlertShowing(): boolean {
  return current !== null;
}

/**
 * Replaces `Alert.alert` everywhere.
 *
 * react-native-web ships `Alert.alert` as an empty stub, and the native one is
 * a plain grey system box. Installing one patched implementation here gives
 * every existing call site (70+ confirmations, errors and success notices) the
 * same coloured in-app dialog on web and on device.
 */
function installAlert() {
  const target = Alert as unknown as {
    alert: (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: 'none' | 'default' | { onDismiss?: () => void; cancelable?: boolean } | undefined
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
export function showWebAlert(dialog: Omit<AlertDialogState, 'key'>): void {
  queue.push({ ...dialog, key: ++seq });
  pump();
}

installAlert();

type ToneName = 'success' | 'error' | 'warning' | 'danger' | 'question' | 'info';

const TONES: Record<
  ToneName,
  { accent: string; onAccent: string; icon: React.ComponentProps<typeof Icon>['as'] }
> = {
  success: { accent: '#34D399', onAccent: '#04130D', icon: CircleCheckIcon },
  error: { accent: '#F87171', onAccent: '#FFFFFF', icon: CircleXIcon },
  warning: { accent: '#FBBF24', onAccent: '#1A1203', icon: TriangleAlertIcon },
  danger: { accent: '#F87171', onAccent: '#FFFFFF', icon: TriangleAlertIcon },
  question: { accent: '#3ADD6C', onAccent: '#04110A', icon: CircleQuestionMarkIcon },
  info: { accent: '#38BDF8', onAccent: '#031019', icon: InfoIcon },
};

/** Pick a colour/icon from what the alert says — no call sites need to change. */
function toneFor(dialog: AlertDialogState): ToneName {
  const title = dialog.title.toLowerCase();
  if (/(failed|could not|couldn't|can't|cannot|error|denied|unable|wrong|incorrect|expired|not allowed|blocked|unavailable)/.test(title))
    return 'error';
  if (dialog.buttons.some((b) => b.style === 'destructive')) return 'danger';
  if (/(missing|required|invalid|permission|pick |select |choose|enter |check |too )/.test(title))
    return 'warning';
  if (/\b(saved|added|created|updated|sent|approved|done|success|copied|deleted|removed|restored|reactivated|deactivated|forgiven|submitted|uploaded|welcome|ready)\b/.test(title))
    return 'success';
  if (title.trim().endsWith('?') || dialog.buttons.length > 1) return 'question';
  return 'info';
}

function AlertButtonView({
  button,
  tone,
  row,
  onPress,
}: {
  button: AlertButton;
  tone: (typeof TONES)[ToneName];
  row: boolean;
  onPress: () => void;
}) {
  const isCancel = button.style === 'cancel';
  const isDestructive = button.style === 'destructive';
  const bg = isCancel ? 'transparent' : isDestructive ? '#EF4444' : tone.accent;
  const fg = isCancel ? undefined : isDestructive ? '#FFFFFF' : tone.onAccent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={
        (row ? 'flex-1 ' : 'w-full ') +
        (isCancel
          ? 'h-12 items-center justify-center rounded-2xl border border-border active:opacity-70'
          : 'h-12 items-center justify-center rounded-2xl active:opacity-80')
      }
      style={isCancel ? undefined : { backgroundColor: bg }}>
      <Text
        className={isCancel ? 'text-sm font-semibold text-foreground' : 'text-sm font-bold'}
        style={fg ? { color: fg } : undefined}>
        {button.text ?? 'OK'}
      </Text>
    </Pressable>
  );
}

/**
 * Mount once near the root of the app. Renders queued alerts as a coloured,
 * icon-led card over a dimmed backdrop.
 */
export function WebAlertHost() {
  const [dialog, setDialog] = React.useState<AlertDialogState | null>(current);
  const [scale] = React.useState(() => new Animated.Value(0.92));
  const [fade] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    listener = setDialog;
    // Show anything that was queued before this host mounted.
    if (current) setDialog(current);
    return () => {
      if (listener === setDialog) listener = null;
    };
  }, []);

  React.useEffect(() => {
    if (!dialog) return;
    scale.setValue(0.92);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 120 }),
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [dialog?.key, scale, fade]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dialog) return null;

  const toneName = toneFor(dialog);
  const tone = TONES[toneName];
  const cancel = dialog.buttons.filter((b) => b.style === 'cancel');
  const actions = dialog.buttons.filter((b) => b.style !== 'cancel');
  // Two buttons sit side by side (cancel left); three or more stack, primary first.
  const row = dialog.buttons.length <= 2;
  const ordered = row ? [...cancel, ...actions] : [...actions, ...cancel];

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeDialog}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,6,12,0.7)', opacity: fade }]}
        />
        <Pressable
          onPress={closeDialog}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View
          style={{ width: '100%', maxWidth: 400, opacity: fade, transform: [{ scale }] }}>
          <View
            className="overflow-hidden rounded-3xl border border-border bg-card"
            style={{
              shadowColor: tone.accent,
              shadowOpacity: 0.35,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 10 },
              elevation: 16,
            }}>
            {/* Colour bar */}
            <View style={{ height: 5, backgroundColor: tone.accent }} />
            <View className="items-center gap-4 px-6 pb-6 pt-7">
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${tone.accent}22`,
                  borderWidth: 1.5,
                  borderColor: `${tone.accent}55`,
                }}>
                <Icon as={tone.icon} size={32} color={tone.accent} />
              </View>
              <View className="items-center gap-2">
                <Text className="text-center text-lg font-bold text-foreground">
                  {dialog.title}
                </Text>
                {dialog.message ? (
                  <Text variant="muted" className="text-center text-sm leading-6">
                    {dialog.message}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  width: '100%',
                  gap: 10,
                  flexDirection: row ? 'row' : 'column',
                }}>
                {ordered.map((button, index) => (
                  <AlertButtonView
                    key={`${dialog.key}-${index}`}
                    button={button}
                    tone={tone}
                    row={row}
                    onPress={() => {
                      button.onPress?.();
                      closeDialog();
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
