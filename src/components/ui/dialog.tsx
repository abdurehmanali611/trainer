import { Icon } from '@/components/ui/icon';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { cn } from '@/lib/utils';
import { isWebAlertShowing } from '@/lib/web-alert';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import {
  Platform,
  ScrollView,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

function DialogOverlay({
  className,
  children,
  onPress,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, 'asChild'> & {
  children?: React.ReactNode;
}) {
  const { onOpenChange } = DialogPrimitive.useRootContext();

  function onOverlayPress(event: GestureResponderEvent) {
    onPress?.(event);
    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
      onOpenChange(false);
    }
  }

  return (
    <FullWindowOverlay>
      <DialogPrimitive.Overlay
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black/50 p-2',
          Platform.select({
            web: 'animate-in fade-in-0 fixed cursor-default [&>*]:cursor-auto',
          }),
          className
        )}
        {...props}
        onPress={Platform.select({ web: onOverlayPress, native: onPress })}
        asChild={Platform.OS !== 'web'}>
        <NativeOnlyAnimatedView
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
          as="Pressable">
          <NativeOnlyAnimatedView
            entering={FadeIn.delay(50).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}>
            <>{children}</>
          </NativeOnlyAnimatedView>
        </NativeOnlyAnimatedView>
      </DialogPrimitive.Overlay>
    </FullWindowOverlay>
  );
}
function DialogContent({
  className,
  portalHost,
  style,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  portalHost?: string;
  style?: StyleProp<ViewStyle>;
}) {
  // The dialog never grows past the viewport: on web 85% of the window
  // height, on native 88% of the available space. Combine with <DialogBody>
  // for the form content so headers and footers stay pinned while the body
  // scrolls.
  const maxHeight = Platform.select({
    web: '85vh',
    default: '88%',
  }) as ViewStyle['maxHeight'];

  // While a web alert (our Alert.alert replacement) is on screen, focus moves
  // outside this dialog — Radix interprets that as a dismiss gesture and
  // closes the dialog behind the alert. Swallow the outside/escape events so
  // the dialog is still there when the alert's OK button is pressed.
  function swallowWhileAlerting(ev: Event) {
    if (isWebAlertShowing()) ev.preventDefault();
  }

  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay>
        <DialogPrimitive.Content
          className={cn(
            'bg-card border-border z-50 mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-4 rounded-xl border p-6 shadow-xl shadow-black/15 dark:shadow-black/50 sm:max-w-lg',
            Platform.select({
              web: 'animate-in fade-in-0 zoom-in-95 duration-200',
            }),
            className
          )}
          onEscapeKeyDown={swallowWhileAlerting}
          onInteractOutside={swallowWhileAlerting}
          onPointerDownOutside={swallowWhileAlerting}
          style={[{ maxHeight }, style]}
          {...props}>
          <>{children}</>
          <DialogPrimitive.Close
            className={cn(
              'absolute right-4 top-4 rounded opacity-70 active:opacity-100',
              Platform.select({
                web: 'ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2',
              })
            )}
            hitSlop={12}>
            <Icon
              as={X}
              className={cn('text-accent-foreground web:pointer-events-none size-4 shrink-0')}
            />
            <Text className="sr-only">Close</Text>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  );
}

/**
 * Scrollable middle section of a dialog.
 *
 * Place between <DialogHeader> and <DialogFooter>: it shrinks to the space
 * the dialog has left (DialogContent caps the dialog's height) and scrolls
 * when the content overflows. Pass a className for the gap between rows,
 * e.g. `className="gap-3"`.
 */
function DialogBody({
  className,
  contentContainerClassName,
  style,
  contentContainerStyle,
  children,
  ...props
}: React.ComponentProps<typeof ScrollView> & { contentContainerClassName?: string }) {
  return (
    <ScrollView
      style={[{ flexGrow: 0, flexShrink: 1 }, style]}
      contentContainerStyle={[{ paddingBottom: 4 }, contentContainerStyle]}
      contentContainerClassName={contentContainerClassName}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}

/**
 * A titled card for grouping related fields inside a dialog body.
 *
 * Gives dialogs the "card partition" look: rounded border, soft background,
 * and a small primary-tinted icon + uppercase section label.
 */
function DialogSection({
  icon,
  label,
  className,
  children,
}: {
  icon?: React.ComponentProps<typeof Icon>['as'];
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className={cn(
        'gap-2.5 rounded-2xl border border-border bg-background/50 p-3.5',
        className
      )}>
      {label ? (
        <View className="flex-row items-center gap-1.5">
          {icon ? <Icon as={icon} size={14} className="text-primary" /> : null}
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  );
}

function DialogFooter({ className, children, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-row gap-2', className)} {...props}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ className?: string }>, {
              className: cn('flex-1', (child.props as { className?: string })?.className),
            })
          : child
      )}
    </View>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-foreground text-lg font-semibold leading-none', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogBody,
  DialogContent,
  DialogSection,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
