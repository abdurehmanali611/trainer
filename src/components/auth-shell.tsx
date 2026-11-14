import { DumbbellIcon, ZapIcon } from 'lucide-react-native';
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
      <View className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-cyan-400/25" />
      <View className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-lime-400/20" />
      <View className="absolute right-10 top-1/3 h-24 w-24 rounded-full bg-white/10" />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerClassName="min-h-full flex-grow items-center justify-center px-5 py-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className={cn('w-full', wide ? 'max-w-3xl' : 'max-w-md')}>
              <View className="mb-7 items-center gap-3">
                <View className="relative">
                  <View className="h-20 w-20 items-center justify-center rounded-xl border border-white/35 bg-white/15 shadow-lg shadow-cyan-500/40">
                    <Icon as={DumbbellIcon} color="#ffffff" size={34} />
                  </View>
                  <View className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full bg-lime-400">
                    <Icon as={ZapIcon} color="#0F172A" size={16} />
                  </View>
                </View>
                <Text className="text-3xl font-black tracking-tight text-white">{brand}</Text>
                <Text className="text-center text-sm font-medium text-cyan-100/90">{tagline}</Text>
              </View>

              <View
                className={cn(
                  'rounded-2xl border border-white/25 bg-card/95 p-6 shadow-2xl shadow-black/30',
                  className
                )}>
                <Text className="text-2xl font-black tracking-tight text-foreground">{title}</Text>
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
