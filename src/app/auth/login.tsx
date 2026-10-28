import { Link, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { PlatformBlockedError, useAuth } from '@/lib/auth';
import { setLockedCredentials } from '@/lib/locked-session';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function onSubmit() {
    if (!username.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      router.replace('/');
    } catch (e) {
      if (e instanceof PlatformBlockedError) {
        setLockedCredentials(username.trim(), password);
        router.replace('/platform-lock');
        return;
      }
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your clients."
      footer={
        <View className="w-full max-w-md flex-row items-center justify-center gap-2">
          <Link href="/auth/forgot-password" asChild>
            <Button variant="link" size="sm" className="rounded-full px-4">
              <Text className="text-sm font-semibold text-white/90 underline underline-offset-4">
                Forgot password?
              </Text>
            </Button>
          </Link>
          <View className="h-4 w-px bg-white/30" />
          <Link href="/auth/register" asChild>
            <Button variant="link" size="sm" className="rounded-full px-4">
              <Text className="text-sm font-semibold text-white underline underline-offset-4">
                Create account
              </Text>
            </Button>
          </Link>
        </View>
      }>
      <Input
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <Input
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button disabled={loading} onPress={onSubmit}>
        <Text className="text-sm font-semibold text-primary-foreground">
          {loading ? 'Signing in…' : 'Sign in'}
        </Text>
      </Button>
    </AuthShell>
  );
}

