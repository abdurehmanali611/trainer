import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { format, getDaysInMonth, getDay, parseISO, startOfMonth } from 'date-fns';

import { Icon } from '@/components/ui/icon';
import { FieldShell, PickerModal } from '@/components/ui/picker-shell';
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
  minDate,
  maxDate,
}: {
  value?: string;
  onChange: (iso: string) => void;
  /** Earliest selectable day (ISO `yyyy-MM-dd`); earlier days are dimmed and inert. */
  minDate?: string;
  /** Latest selectable day (ISO `yyyy-MM-dd`). */
  maxDate?: string;
  className?: string;
}) {
  const [month, setMonth] = React.useState(() => {
    try {
      if (value) return startOfMonth(parseISO(value));
      if (minDate && minDate > isoOf(new Date())) return startOfMonth(parseISO(minDate));
      return startOfMonth(new Date());
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
          <Icon as={ChevronLeftIcon} size={16} color="#8F9CAE" className="text-muted-foreground" />
        </Pressable>
        <Text className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full border border-border active:bg-accent">
          <Icon as={ChevronRightIcon} size={16} color="#8F9CAE" className="text-muted-foreground" />
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
          const outOfRange = (minDate != null && iso < minDate) || (maxDate != null && iso > maxDate);
          return (
            <Pressable
              key={iso}
              disabled={outOfRange}
              onPress={() => onChange(iso)}
              // NOTE: the pressed style lives on this Pressable, never on the
              // inner View — an `active:` class on a plain View makes it claim
              // the touch on native, so the Pressable's onPress never fires.
              className={cn(
                'w-[14.28%] items-center justify-center p-1 active:opacity-60',
                outOfRange && 'opacity-25'
              )}>
              <View
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-full',
                  isSelected
                    ? 'bg-primary shadow-sm shadow-primary/40'
                    : isToday
                      ? 'border border-primary/50'
                      : ''
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
            const iso = isoOf(now);
            if ((minDate != null && iso < minDate) || (maxDate != null && iso > maxDate)) return;
            setMonth(startOfMonth(now));
            onChange(iso);
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

/** Date field that expands a calendar inline — safe inside dialogs/sheets. */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  minDate,
  maxDate,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
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
        Platform.OS === 'web' ? (
          <Calendar
            value={value}
            minDate={minDate}
            maxDate={maxDate}
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        ) : (
          <PickerModal title={label ?? 'Pick a date'} onClose={() => setOpen(false)}>
            <Calendar
              value={value}
              minDate={minDate}
              maxDate={maxDate}
              onChange={(iso) => {
                onChange(iso);
                setOpen(false);
              }}
            />
          </PickerModal>
        )
      ) : null}
    </View>
  );
}

/**
 * Date field that opens the month calendar in a popover — same API as
 * `DateField`, but the calendar floats instead of pushing content down.
 */
export function DatePopoverField(props: DatePopoverFieldProps) {
  // Native popovers are portaled to the app root, which sits *behind* an open
  // dialog's overlay (taps never reach them). Expand inline there instead.
  if (Platform.OS !== 'web') {
    return (
      <DateField
        label={props.label}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        className={props.className}
        minDate={props.minDate}
        maxDate={props.maxDate}
      />
    );
  }
  return <WebDatePopoverField {...props} />;
}

type DatePopoverFieldProps = {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
  minDate?: string;
  maxDate?: string;
};

function WebDatePopoverField({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  align = 'start',
  minDate,
  maxDate,
}: DatePopoverFieldProps) {
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
            <Icon as={CalendarDaysIcon} size={16} color="#8F9CAE" className="shrink-0 text-muted-foreground" />
          </Pressable>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-80 p-2">
          <Calendar
            value={value}
            minDate={minDate}
            maxDate={maxDate}
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

export { TimeField, TimePopoverField } from '@/components/ui/time-picker';
