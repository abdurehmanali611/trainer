import { Link } from 'expo-router';
import * as React from 'react';
import { Alert, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit() {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await api('auth/password/forgot/', {
        method: 'POST',
        body: { email: email.trim() },
        auth: false,
      });
      setSent(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle={sent ? 'Check your email for a reset link.' : "We'll email you a reset link."}
      footer={
        <Link href="/auth/login" asChild>
          <Button variant="link" size="sm">
            <Text className="text-sm font-semibold text-white/90">Back to sign in</Text>
          </Button>
        </Link>
      }>
      {sent ? (
        <View className="rounded-2xl bg-success/10 p-4">
          <Text className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            If that email is registered, a reset link is on its way.
          </Text>
        </View>
      ) : (
        <>
          <Input
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Button disabled={loading} onPress={onSubmit}>
            <Text className="text-sm font-semibold text-primary-foreground">
              {loading ? 'Sending…' : 'Send reset link'}
            </Text>
          </Button>
        </>
      )}
    </AuthShell>
  );
}
