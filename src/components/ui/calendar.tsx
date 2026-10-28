import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { format, getDaysInMonth, getDay, parseISO, startOfMonth } from 'date-fns';

import { Icon } from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isoOf(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Month-grid calendar. Controlled by an ISO `yyyy-MM-dd` value; tapping a day
 * reports the new ISO string back through `onChange`.
 */
export function Calendar({
  value,
  onChange,
  className,
}: {
  value?: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const [month, setMonth] = React.useState(() => {
    try {
      return value ? startOfMonth(parseISO(value)) : startOfMonth(new Date());
    } catch {
      return startOfMonth(new Date());
    }
  });

  const daysInMonth = getDaysInMonth(month);
  const leading = getDay(startOfMonth(month));
  const selected = (() => {
    try {
      return value ? parseISO(value) : null;
    } catch {
      return null;
    }
  })();

  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index + 1)
    ),
  ];

  const todayIso = isoOf(new Date());

  return (
    <View className="rounded-xl border border-border bg-card p-3 shadow-sm shadow-black/10 dark:shadow-black/40">
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full border border-border active:bg-accent">
          <Icon as={ChevronLeftIcon} size={16} className="text-muted-foreground" />
        </Pressable>
        <Text className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full border border-border active:bg-accent">
          <Icon as={ChevronRightIcon} size={16} className="text-muted-foreground" />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((day, index) => (
          <Text
            key={`${day}-${index}`}
            className="w-[14.28%] text-center text-[10px] font-semibold uppercase text-muted-foreground">
            {day}
          </Text>
        ))}
      </View>

      <View className="mt-1 flex-row flex-wrap">
        {cells.map((date, index) => {
          if (!date) return <View key={`pad-${index}`} className="w-[14.28%] p-1" />;
          const iso = isoOf(date);
          const isSelected = value != null && selected != null && iso === value;
          const isToday = iso === todayIso;
          return (
            <Pressable
              key={iso}
              onPress={() => onChange(iso)}
              className="w-[14.28%] items-center justify-center p-1">
              <View
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-full',
                  isSelected
                    ? 'bg-primary shadow-sm shadow-primary/40'
                    : isToday
                      ? 'border border-primary/50'
                      : 'active:bg-accent'
                )}>
                <Text
                  className={cn(
                    'text-[13px]',
                    isSelected
                      ? 'font-bold text-white'
                      : isToday
                        ? 'font-semibold text-primary'
                        : 'text-foreground'
                  )}>
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-2 flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            const now = new Date();
            setMonth(startOfMonth(now));
            onChange(isoOf(now));
          }}
          className="rounded-full bg-primary/10 px-3 py-1.5 active:opacity-70">
          <Text className="text-xs font-semibold text-primary">Today</Text>
        </Pressable>
        <Text variant="muted" className="text-[11px]">
          {selected ? format(selected, 'EEE, MMM d, yyyy') : 'No date picked'}
        </Text>
      </View>
    </View>
  );
}

function FieldShell({
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
          className="shrink-0 text-muted-foreground"
        />
      </Pressable>
    </View>
  );
}

/** Date field that expands a calendar inline — safe inside dialogs/sheets. */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  let display: string | null = null;
  try {
    display = value ? format(parseISO(value), 'EEE, MMM d, yyyy') : null;
  } catch {
    display = value || null;
  }

  return (
    <View className={cn('gap-1.5', className)}>
      <FieldShell
        label={label}
        active={open}
        placeholder={placeholder}
        icon="date"
        displayValue={display}
        onToggle={() => setOpen((o) => !o)}
        trailing={
          display ? (
            <Pressable
              onPress={() => onChange('')}
              hitSlop={8}
              className="rounded-full bg-secondary px-2 py-0.5 active:opacity-70">
              <Text className="text-[10px] font-semibold text-secondary-foreground">Clear</Text>
            </Pressable>
          ) : undefined
        }
      />
      {open ? (
        <Calendar
          value={value}
          onChange={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Date field that opens the month calendar in a popover — same API as
 * `DateField`, but the calendar floats instead of pushing content down.
 */
export function DatePopoverField({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  align = 'start',
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const triggerRef = React.useRef<React.ComponentRef<typeof PopoverTrigger> | null>(null);
  let display: string | null = null;
  try {
    display = value ? format(parseISO(value), 'EEE, MMM d, yyyy') : null;
  } catch {
    display = value || null;
  }

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
                display ? 'text-foreground' : 'text-muted-foreground'
              )}
              numberOfLines={1}>
              {display ?? placeholder}
            </Text>
            <Icon as={CalendarDaysIcon} size={16} className="shrink-0 text-muted-foreground" />
          </Pressable>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-80 p-2">
          <Calendar
            value={value}
            onChange={(iso) => {
              onChange(iso);
              triggerRef.current?.close();
            }}
          />
        </PopoverContent>
      </Popover>
    </View>
  );
}

const TIME_SLOTS: string[] = Array.from(
  { length: 24 * 4 },
  (_, index) =>
    `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`
);

function prettyTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${suffix}`;
}

/** Time field that expands a scrollable 15-minute slot picker inline. */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
  className,
}: {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <View className={cn('gap-1.5', className)}>
      <FieldShell
        label={label}
        active={open}
        placeholder={placeholder}
        icon="time"
        displayValue={value ? prettyTime(value) : null}
        onToggle={() => setOpen((o) => !o)}
      />
      {open ? (
        <View className="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/10 dark:shadow-black/40">
          <ScrollView
            style={{ maxHeight: 208 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap p-1.5">
              {TIME_SLOTS.map((slot) => {
                const isSelected = slot === value;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => {
                      onChange(slot);
                      setOpen(false);
                    }}
                    className={cn(
                      'm-0.5 w-[23%] items-center justify-center rounded-lg border px-1 py-2',
                      isSelected
                        ? 'border-primary bg-primary shadow-sm shadow-primary/30'
                        : 'border-border active:bg-accent'
                    )}>
                    <Text
                      className={cn(
                        'text-xs',
                        isSelected ? 'font-bold text-white' : 'text-foreground'
                      )}>
                      {prettyTime(slot)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function TimeSlotGrid({
  value,
  onPick,
}: {
  value: string;
  onPick: (time: string) => void;
}) {
  return (
    <ScrollView
      style={{ maxHeight: 208 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View className="flex-row flex-wrap p-1.5">
        {TIME_SLOTS.map((slot) => {
          const isSelected = slot === value;
          return (
            <Pressable
              key={slot}
              onPress={() => onPick(slot)}
              className={cn(
                'm-0.5 w-[23%] items-center justify-center rounded-lg border px-1 py-2',
                isSelected
                  ? 'border-primary bg-primary shadow-sm shadow-primary/30'
                  : 'border-border active:bg-accent'
              )}>
              <Text
                className={cn(
                  'text-xs',
                  isSelected ? 'font-bold text-white' : 'text-foreground'
                )}>
                {prettyTime(slot)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * Time field that opens the 15-minute slot picker in a popover — same API as
 * `TimeField`, but the picker floats instead of pushing content down.
 */
export function TimePopoverField({
  label,
  value,
  onChange,
  placeholder = 'Pick a time',
  className,
  align = 'start',
}: {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
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
            <Icon as={ClockIcon} size={16} className="shrink-0 text-muted-foreground" />
          </Pressable>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-72 p-2">
          <TimeSlotGrid
            value={value}
            onPick={(time) => {
              onChange(time);
              triggerRef.current?.close();
            }}
          />
        </PopoverContent>
      </Popover>
    </View>
  );
}
