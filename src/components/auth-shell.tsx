import { Image } from 'expo-image';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deepGradient, Gradient } from '@/components/gradient';
import { alpha, COLORS } from '@/components/kit';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  brand?: string;
  /** Accepted for compatibility; the logo artwork already carries the tagline. */
  tagline?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Wider card for long forms (registration). */
  wide?: boolean;
}

// Transparent FitPilot logo (generated from assets/images/fitpilot.png).
const LOGO = require('../../assets/images/fitpilot-splash.png');

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  className,
  wide = false,
}: AuthShellProps) {
  return (
    <Gradient colors={deepGradient} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={{ flex: 1 }}>
      {/* Soft colour glows behind the card */}
      <View
        style={{
          position: 'absolute',
          top: -120,
          right: -100,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: alpha(COLORS.green, 0.22),
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -140,
          left: -110,
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: alpha(COLORS.cyan, 0.12),
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '38%',
          left: -40,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: alpha(COLORS.lime, 0.1),
        }}
      />
      {/* NativeWind className is dropped on SafeAreaView on native, so the
          flex sizing must be a style or the screen collapses to nothing. */}
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 20,
              paddingVertical: 24,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View className={cn('w-full self-center', wide ? 'max-w-3xl' : 'max-w-md')}>
            <View className="mb-4 items-center">
              {/* The logo artwork already carries the "Train · Track · Grow" line. */}
              <Image source={LOGO} style={{ width: 260, height: 210 }} contentFit="contain" />
              <View
                className="mt-1 rounded-full px-3.5 py-1.5"
                style={{ backgroundColor: alpha(COLORS.lime, 0.14), borderWidth: 1, borderColor: alpha(COLORS.lime, 0.35) }}>
                <Text className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: COLORS.lime }}>
                  Coach console
                </Text>
              </View>
            </View>

            <View
              className={cn('rounded-[28px] border p-6', className)}
              style={{
                backgroundColor: 'rgba(11, 18, 32, 0.92)',
                borderColor: alpha(COLORS.green, 0.28),
                shadowColor: COLORS.green,
                shadowOpacity: 0.25,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 10 },
                elevation: 12,
              }}>
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
