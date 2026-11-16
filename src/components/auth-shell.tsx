import { DumbbellIcon } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deepGradient, Gradient } from '@/components/gradient';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  brand?: string;
  tagline?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  wide?: boolean;
}

export function AuthShell({
  title,
  subtitle,
  brand = 'Trainer',
  tagline = 'Coach smarter. Train harder.',
  children,
  footer,
  className,
  wide = false,
}: AuthShellProps) {
  return (
    <Gradient colors={deepGradient} style={{ flex: 1 }}>
      <View className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/15" />
      <View className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-black/25" />
      {/* NativeWind's polyfill does NOT wrap SafeAreaView on native (it's a
          native component that drops className), so className="flex-1" was
          silently ignored on device → this subtree collapsed to height 0 and
          the screen rendered as gradient + circles only. Use style instead. */}
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerClassName="min-h-full flex-grow items-center justify-center px-5 py-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className={cn('w-full', wide ? 'max-w-3xl' : 'max-w-md')}>
              <View className="mb-7 items-center gap-3">
                <View className="h-16 w-16 items-center justify-center rounded-xl border border-border bg-card">
                  <Icon as={DumbbellIcon} color="#2DD4BF" size={28} />
                </View>
                <Text className="text-3xl font-semibold tracking-tight text-foreground">{brand}</Text>
                <Text className="text-center text-sm text-muted-foreground">{tagline}</Text>
              </View>

              <View
                className={cn(
                  'rounded-xl border border-border bg-card p-5 shadow-sm shadow-black/30',
                  className
                )}>
                <Text className="text-xl font-semibold tracking-tight text-foreground">{title}</Text>
                {subtitle ? (
                  <Text className="mt-1.5 text-sm leading-5 text-muted-foreground">{subtitle}</Text>
                ) : null}
                <View className="mt-5 gap-4">{children}</View>
              </View>

              {footer ? <View className="mt-5 items-center">{footer}</View> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Gradient>
  );
}
