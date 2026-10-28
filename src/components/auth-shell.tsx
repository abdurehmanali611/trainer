import { DumbbellIcon } from 'lucide-react-native';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Gradient } from '@/components/gradient';
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
  tagline = 'Coach smarter. Train better.',
  children,
  footer,
  className,
  wide = false,
}: AuthShellProps) {
  return (
    <Gradient style={{ flex: 1 }}>
      <View className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10" />
      <View className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10" />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerClassName="min-h-full flex-grow items-center justify-center px-5 py-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className={cn('w-full', wide ? 'max-w-3xl' : 'max-w-md')}>
              <View className="mb-6 items-center gap-2">
                <View className="h-16 w-16 items-center justify-center rounded-2xl border border-white/30 bg-white/15">
                  <Icon as={DumbbellIcon} color="#ffffff" size={30} />
                </View>
                <Text className="text-2xl font-extrabold tracking-tight text-white">{brand}</Text>
                <Text className="text-center text-sm text-white/80">{tagline}</Text>
              </View>

              <View
                className={cn(
                  'rounded-3xl border border-white/20 bg-card p-6 shadow-xl shadow-black/20',
                  className
                )}>
                <Text className="text-2xl font-bold tracking-tight text-foreground">{title}</Text>
                {subtitle ? (
                  <Text className="mt-1 text-sm text-muted-foreground">{subtitle}</Text>
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
