import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react-native';
import { Portal } from '@rn-primitives/portal';
import * as React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
  value: string;
  label: string;
  /** Optional secondary text shown next to the label (e.g. dial code). */
  hint?: string;
};

type ComboboxSharedProps = {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  emptyText?: string;
};

export type ComboboxProps = ComboboxSharedProps &
  (
    | { multiple?: false; value: string; onValueChange: (value: string) => void }
    | { multiple: true; value: string[]; onValueChange: (values: string[]) => void }
  );

/**
 * Searchable combobox: a trigger that opens a panel with a text field which
 * filters the options as you type.
 *
 * Single-select by default; pass `multiple` to toggle several options (the
 * panel stays open until dismissed).
 *
 * On web the panel is rendered in place, absolutely anchored directly beneath
 * the trigger (top: 100%). Anchoring to the trigger instead of using
 * viewport-measured `position: fixed` keeps the panel directly below the field
 * even inside dialogs, where an animated ancestor becomes the containing block
 * for fixed descendants and would fling the panel into the middle of the form.
 * On native it is portaled and anchored under the trigger.
 */
export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    align = 'right',
    className,
    triggerClassName,
    disabled,
    emptyText = 'No matches',
  } = props;
  const multiple = props.multiple === true;
  const selectedValues: string[] = multiple
    ? props.value
    : props.value
      ? [props.value]
      : [];

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const triggerRef = React.useRef<unknown>(null);
  const portalName = `combobox-${React.useId()}`;

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);
  const triggerLabel = multiple
    ? selectedLabels.length === 0
      ? null
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`
    : (selectedLabels[0] ?? null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q) ||
        (option.hint ?? '').toLowerCase().includes(q)
    );
  }, [options, query]);

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    setQuery('');
    if (Platform.OS === 'web') {
      // Make sure the trigger is fully inside its scroll container before the
      // panel opens below it, so the list isn't pushed out of view.
      const node = triggerRef.current as {
        scrollIntoView?: (options?: { block?: 'nearest' | 'start' | 'center' | 'end' }) => void;
      } | null;
      node?.scrollIntoView?.({ block: 'nearest' });
    }
    setOpen(true);
  }

  function choose(option: ComboboxOption) {
    if (multiple) {
      const next = selectedValues.includes(option.value)
        ? selectedValues.filter((v) => v !== option.value)
        : [...selectedValues, option.value];
      (props.onValueChange as (values: string[]) => void)(next);
      return;
    }
    (props.onValueChange as (value: string) => void)(option.value);
    setOpen(false);
  }

  const panelStyle: StyleProp<ViewStyle> =
    Platform.OS === 'web'
      ? ({
          position: 'absolute',
          top: '100%',
          marginTop: 6,
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          minWidth: 240,
          maxWidth: '90vw',
          zIndex: 9999,
        } as unknown as ViewStyle)
      : {
          position: 'absolute',
          top: 48,
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          width: 260,
          zIndex: 9999,
        };

  const panelContent = (
    <>
      {Platform.OS === 'web' ? (
        <Pressable
          onPress={() => setOpen(false)}
          pointerEvents="auto"
          style={
            {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
            } as unknown as ViewStyle
          }
        />
      ) : null}
      <View
        pointerEvents="auto"
        style={[panelStyle, { elevation: 12 }]}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/15 dark:shadow-black/40">
        <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
          <Icon as={SearchIcon} size={15} className="text-muted-foreground" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus={Platform.OS === 'web'}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={searchPlaceholder}
            placeholderTextColor="var(--muted-foreground, #94a3b8)"
            returnKeyType="search"
            className="h-7 min-w-0 flex-1 p-0 text-sm text-foreground"
          />
        </View>
        <ScrollView
          style={{ maxHeight: 240 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          nestedScrollEnabled>
          {filtered.length === 0 ? (
            <Text variant="muted" className="px-3 py-3 text-xs">
              {emptyText}
            </Text>
          ) : (
            filtered.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option)}
                  className={cn(
                    'flex-row items-center gap-2 px-3 py-2.5 active:bg-accent',
                    isSelected && 'bg-accent'
                  )}>
                  <Text
                    className={cn(
                      'min-w-0 flex-1 text-sm',
                      isSelected && 'font-semibold text-primary'
                    )}
                    numberOfLines={1}>
                    {option.label}
                  </Text>
                  {option.hint ? (
                    <Text variant="muted" className="text-xs">
                      {option.hint}
                    </Text>
                  ) : null}
                  {multiple && isSelected ? (
                    <Icon as={CheckIcon} size={14} className="text-primary" />
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );

  // On web the panel renders in place instead of through the root portal
  // host: that host lives inside `#root`, which an open dialog (a later
  // body-level sibling) paints over — hiding the panel behind the dialog no
  // matter its zIndex. Rendering inside the dialog's tree also inherits
  // `pointer-events: auto` (Radix sets `pointer-events: none` on body while a
  // dialog is open) and keeps the search input inside the dialog's focus scope.
  const panel =
    open ? (Platform.OS === 'web' ? panelContent : <Portal name={portalName}>{panelContent}</Portal>) : null;

  return (
    <View
      // Lift the whole control (trigger + panel) into its own stacking
      // context while open. Without this, the panel's z-index is evaluated
      // against later sibling form rows and gets painted underneath them.
      style={open ? { zIndex: 60 } : undefined}
      className={cn('relative', className)}>
      <Button
        ref={triggerRef as never}
        variant="outline"
        disabled={disabled}
        onPress={toggle}
        accessibilityRole="combobox"
        aria-expanded={open}
        className={cn('h-11 w-full flex-row items-center justify-between gap-2 rounded-xl px-3', triggerClassName)}>
        <Text
          numberOfLines={1}
          className={cn(
            'min-w-0 flex-1 text-left text-sm',
            !triggerLabel && 'text-muted-foreground'
          )}>
          {triggerLabel ?? placeholder}
        </Text>
        <Icon
          as={ChevronDownIcon}
          size={16}
          className={cn('shrink-0 text-muted-foreground', open && 'rotate-180')}
        />
      </Button>
      {panel}
    </View>
  );
}
