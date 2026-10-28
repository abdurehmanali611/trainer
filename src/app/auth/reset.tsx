import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function onSubmit() {
    if (!token) {
      Alert.alert('Invalid link', 'This reset link is missing its token.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api('auth/password/reset/', {
        method: 'POST',
        body: { token, new_password: password },
        auth: false,
      });
      Alert.alert('Done', 'Password updated. You can now sign in.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Set new password" subtitle="Choose a new password for your account.">
      <Input
        placeholder="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button disabled={loading} onPress={onSubmit}>
        <Text className="text-sm font-semibold text-primary-foreground">
          {loading ? 'Saving…' : 'Update password'}
        </Text>
      </Button>
    </AuthShell>
  );
}
