import { CalendarDaysIcon, ClockIcon, XIcon } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Native picker surface: a centred card in its own transparent `Modal`.
 *
 * A native Modal is a separate window above everything — including an open
 * dialog — so taps always reach it. Expanding a picker inside a dialog's
 * scroll body instead means nested scroll views, a content-measured body
 * height and a keyboard-shrunk dialog all have to cooperate. Backdrop tap and
 * the Android back button dismiss it.
 */
export function PickerModal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable
          accessibilityLabel="Close picker"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
        />
        <View
          className="w-full gap-3 rounded-2xl border border-border bg-card p-3"
          style={{ maxWidth: 380 }}>
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-sm font-semibold">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Icon as={XIcon} size={16} color="#8F9CAE" className="text-muted-foreground" />
            </Pressable>
          </View>
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
}

/** The tappable field that shows the current value and opens a picker. */
export function FieldShell({
  label,
  active,
  placeholder,
  icon,
  displayValue,
  onToggle,
  trailing,
}: {
  label?: string;
  active: boolean;
  placeholder: string;
  icon: 'date' | 'time';
  displayValue: string | null;
  onToggle: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="muted" className="text-xs font-medium">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        className={cn(
          'h-11 flex-row items-center justify-between gap-2 rounded-xl border bg-background px-3',
          active ? 'border-primary ring-2 ring-primary/25' : 'border-input'
        )}>
        <Text
          className={cn(
            'min-w-0 flex-1 text-left text-sm',
            displayValue ? 'text-foreground' : 'text-muted-foreground'
          )}
          numberOfLines={1}>
          {displayValue ?? placeholder}
        </Text>
        {trailing}
        <Icon
          as={icon === 'date' ? CalendarDaysIcon : ClockIcon}
          size={16}
          color="#8F9CAE"
          className="shrink-0 text-muted-foreground"
        />
      </Pressable>
    </View>
  );
}
