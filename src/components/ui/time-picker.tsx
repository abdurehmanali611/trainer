import { ClockIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';

import { FieldShell, PickerModal } from '@/components/ui/picker-shell';
import { Icon } from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const ITEM_H = 40;
const VISIBLE_ROWS = 5;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 00–59

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" (24h) -> { hour: 1-12, minute: 0-59, pm } — defaults to 9:00 AM. */
function parseTime(value: string): { hour: number; minute: number; pm: boolean } {
  const [h, m] = (value || '').split(':');
  const h24 = parseInt(h, 10);
  const minute = parseInt(m, 10);
  if (Number.isNaN(h24) || Number.isNaN(minute)) return { hour: 9, minute: 0, pm: false };
  return { hour: h24 % 12 || 12, minute: Math.min(Math.max(minute, 0), 59), pm: h24 >= 12 };
}

/** { hour: 1-12, minute, pm } -> "HH:MM" (24h). */
function toTime(hour: number, minute: number, pm: boolean): string {
  const h24 = (hour % 12) + (pm ? 12 : 0);
  return `${pad(h24)}:${pad(minute)}`;
}

/** "HH:MM" -> "h:mm AM/PM" for display. */
export function prettyTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return time;
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/** One scrollable column of numbers (hours or minutes). */
function NumberColumn({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const ref = React.useRef<ScrollViewInstance>(null);

  // Bring the current value into view (a couple of rows of context above it).
  React.useEffect(() => {
    const y = Math.max(0, items.indexOf(selected) * ITEM_H - ITEM_H * 2);
    const timer = setTimeout(() => ref.current?.scrollTo({ y, animated: false }), 60);
    return () => clearTimeout(timer);
    // Only on mount: later taps should not re-scroll under the user's finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Text className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <View
        className="overflow-hidden rounded-xl border border-border bg-background"
        style={{ height: ITEM_H * VISIBLE_ROWS }}>
        <ScrollView
          ref={ref}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {items.map((item) => {
            const isSelected = item === selected;
            return (
              <Pressable
                key={item}
                onPress={() => onSelect(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                // Keep `active:` constant: toggling it with `isSelected` makes
                // the styling library remount the row mid-tap.
                className={cn(
                  'mx-1.5 my-0.5 items-center justify-center rounded-lg active:opacity-70',
                  isSelected && 'bg-primary'
                )}
                style={{ height: ITEM_H - 4 }}>
                <Text
                  className={cn(
                    'text-base',
                    isSelected ? 'font-bold text-white' : 'text-foreground'
                  )}>
                  {pad(item)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * The picker body: hour (1–12) and minute (00–59) lists plus an AM / PM
 * switch, with a live readout. Nothing is applied until "Set time".
 */
export function TimePicker({
  value,
  onSubmit,
  onCancel,
  onClear,
}: {
  value: string;
  onSubmit: (time: string) => void;
  onCancel: () => void;
  /** Provide for optional times: shows a Clear action when a time is set. */
  onClear?: () => void;
}) {
  const initial = React.useMemo(() => parseTime(value), [value]);
  const [hour, setHour] = React.useState(initial.hour);
  const [minute, setMinute] = React.useState(initial.minute);
  const [pm, setPm] = React.useState(initial.pm);

  return (
    <View className="gap-3">
      {/* Live readout */}
      <View className="items-center rounded-xl border border-primary/30 bg-primary/10 py-2.5">
        <View className="flex-row items-baseline gap-1.5">
          <Text className="text-3xl font-bold text-foreground">
            {pad(hour)}:{pad(minute)}
          </Text>
          <Text className="text-base font-semibold text-primary">{pm ? 'PM' : 'AM'}</Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <NumberColumn label="Hour" items={HOURS} selected={hour} onSelect={setHour} />
        <NumberColumn label="Minute" items={MINUTES} selected={minute} onSelect={setMinute} />
        <View style={{ flex: 0.8 }}>
          <Text className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            AM / PM
          </Text>
          <View style={{ height: ITEM_H * VISIBLE_ROWS, gap: 8 }}>
            {[
              { label: 'AM', isPm: false },
              { label: 'PM', isPm: true },
            ].map((option) => {
              const isSelected = pm === option.isPm;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setPm(option.isPm)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'items-center justify-center rounded-xl border active:opacity-70',
                    isSelected ? 'border-primary bg-primary' : 'border-border bg-background'
                  )}
                  style={{ flex: 1 }}>
                  <Text
                    className={cn(
                      'text-lg font-bold',
                      isSelected ? 'text-white' : 'text-muted-foreground'
                    )}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="h-11 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70">
          <Text className="text-sm font-semibold">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => onSubmit(toTime(hour, minute, pm))}
          accessibilityRole="button"
          className="h-11 flex-1 items-center justify-center rounded-xl bg-primary active:opacity-80">
          <Text className="text-sm font-bold text-white">Set time</Text>
        </Pressable>
      </View>
      {onClear && value ? (
        <Pressable onPress={onClear} hitSlop={6} className="items-center py-0.5 active:opacity-70">
          <Text className="text-xs font-semibold text-muted-foreground">Clear time</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ClearChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="rounded-full bg-secondary px-2 py-0.5 active:opacity-70">
      <Text className="text-[10px] font-semibold text-secondary-foreground">Clear</Text>
    </Pressable>
  );
}

/**
 * Time field. Tapping it (or the clock icon) opens the hour / minute / AM-PM
 * picker: in its own window on native, expanded in place on web.
 */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
  className,
  clearable,
}: {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
  /** Show a Clear action when a time is set (for optional times). */
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  const picker = (
    <TimePicker
      value={value}
      onCancel={close}
      onSubmit={(time) => {
        onChange(time);
        close();
      }}
      onClear={
        clearable
          ? () => {
              onChange('');
              close();
            }
          : undefined
      }
    />
  );

  return (
    <View className={cn('gap-1.5', className)}>
      <FieldShell
        label={label}
        active={open}
        placeholder={placeholder}
        icon="time"
        displayValue={value ? prettyTime(value) : null}
        onToggle={() => setOpen((o) => !o)}
        trailing={
          clearable && value ? (
            <ClearChip
              onPress={() => {
                onChange('');
                close();
              }}
            />
          ) : undefined
        }
      />
      {open && Platform.OS !== 'web' ? (
        <PickerModal title={label ?? 'Pick a time'} onClose={close}>
          {picker}
        </PickerModal>
      ) : null}
      {open && Platform.OS === 'web' ? (
        <View className="rounded-xl border border-border bg-card p-3 shadow-sm shadow-black/10 dark:shadow-black/40">
          {picker}
        </View>
      ) : null}
    </View>
  );
}

type TimePopoverFieldProps = {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
  clearable?: boolean;
};

/**
 * Same API as `TimeField`; on web the picker floats in a popover instead of
 * pushing the form down. Native uses the pop-up window (a popover would be
 * portaled behind an open dialog).
 */
export function TimePopoverField(props: TimePopoverFieldProps) {
  if (Platform.OS !== 'web') {
    return (
      <TimeField
        label={props.label}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        className={props.className}
        clearable={props.clearable}
      />
    );
  }
  return <WebTimePopoverField {...props} />;
}

function WebTimePopoverField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
  className,
  align = 'start',
  clearable,
}: TimePopoverFieldProps) {
  const triggerRef = React.useRef<React.ComponentRef<typeof PopoverTrigger> | null>(null);

  return (
    <View className={cn('gap-1.5', className)}>
      {label ? (
        <Text variant="muted" className="text-xs font-medium">
          {label}
        </Text>
      ) : null}
      <Popover>
        <PopoverTrigger ref={triggerRef} asChild>
          <Pressable
            accessibilityRole="button"
            className="h-11 flex-row items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 active:opacity-80">
            <Text
              className={cn(
                'min-w-0 flex-1 text-left text-sm',
                value ? 'text-foreground' : 'text-muted-foreground'
              )}
              numberOfLines={1}>
              {value ? prettyTime(value) : placeholder}
            </Text>
            <Icon as={ClockIcon} size={16} color="#8F9CAE" className="shrink-0 text-muted-foreground" />
          </Pressable>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-80 p-3">
          <TimePicker
            value={value}
            onCancel={() => triggerRef.current?.close()}
            onSubmit={(time) => {
              onChange(time);
              triggerRef.current?.close();
            }}
            onClear={
              clearable
                ? () => {
                    onChange('');
                    triggerRef.current?.close();
                  }
                : undefined
            }
          />
        </PopoverContent>
      </Popover>
    </View>
  );
}
