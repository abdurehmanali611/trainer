import { Link, useRouter } from 'expo-router';
import { CheckIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { PhoneNumberInput } from '@/components/phone-input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const CHANNELS = ['Telebirr', 'CBE'];

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, required, hint, children }: FieldProps) {
  return (
    <View className="gap-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-sm font-medium text-destructive"> *</Text> : null}
      </Label>
      {children}
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

function SectionTitle({ title, step, color = '#3ADD6C' }: { title: string; step?: string; color?: string }) {
  return (
    <View className="mb-1 mt-2 flex-row items-center gap-2.5">
      {step ? (
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: color }}>
          <Text className="text-xs font-black" style={{ color: '#04110A' }}>
            {step}
          </Text>
        </View>
      ) : null}
      <Text className="text-[13px] font-black uppercase tracking-widest" style={{ color }}>
        {title}
      </Text>
      <View className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.25 }} />
    </View>
  );
}

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [form, setForm] = React.useState({
    username: '',
    email: '',
    full_name: '',
    phone: '',
    gym_name: '',
    password: '',
    password2: '',
    setup_channel: 'Telebirr',
    setup_transaction_ref: '',
  });
  const [loading, setLoading] = React.useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit() {
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      Alert.alert('Missing fields', 'Username, email and password are required.');
      return;
    }
    if (form.password !== form.password2) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (!form.setup_channel.trim()) {
      Alert.alert('Payment required', 'Select a payment channel.');
      return;
    }
    if (!form.setup_transaction_ref.trim()) {
      Alert.alert('Transaction required', 'Enter your transaction ID/reference.');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        ...form,
        username: form.username.trim(),
        email: form.email.trim(),
        setup_channel: form.setup_channel.trim(),
        setup_transaction_ref: form.setup_transaction_ref.trim(),
      });
      router.replace('/');
    } catch (e) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      wide
      title="Create account"
      subtitle="Submit setup payment to get started."
      tagline="Your coaching business, organized."
      footer={
        <View className="w-full max-w-md flex-row items-center justify-center gap-1.5">
          <Text className="text-sm text-white/70">Already have an account?</Text>
          <Link href="/auth/login" asChild>
            <Button variant="link" size="sm" className="rounded-full px-3">
              <Text className="text-sm font-semibold text-white underline underline-offset-4">
                Sign in
              </Text>
            </Button>
          </Link>
        </View>
      }>
      <View className="flex-col gap-4 md:flex-row md:items-start">
        <View className="gap-4 md:flex-1">
          <SectionTitle title="Your details" step="1" />
          <Field label="Full name">
            <Input placeholder="Abebe Bekele" value={form.full_name} onChangeText={set('full_name')} />
          </Field>
          <Field label="Phone">
            <PhoneNumberInput value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Gym name" hint="Shown on your clients' plans.">
            <Input placeholder="Iron House Gym" value={form.gym_name} onChangeText={set('gym_name')} />
          </Field>
          <Field label="Email" required>
            <Input
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.email}
              onChangeText={set('email')}
            />
          </Field>
          <Field label="Username" required hint="This is what you'll sign in with.">
            <Input
              placeholder="e.g. coach_abebe"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.username}
              onChangeText={set('username')}
            />
          </Field>
          <Field label="Password" required>
            <Input
              placeholder="At least 8 characters"
              secureTextEntry
              value={form.password}
              onChangeText={set('password')}
            />
          </Field>
          <Field
            label="Confirm password"
            required
            hint={
              form.password2 && form.password !== form.password2
                ? 'Passwords do not match.'
                : 'Re-enter the same password to confirm.'
            }>
            <Input
              placeholder="Re-enter your password"
              secureTextEntry
              value={form.password2}
              onChangeText={set('password2')}
            />
          </Field>
        </View>

        <View className="gap-4 md:flex-1">
          <SectionTitle title="Setup payment" step="2" color="#FBBF24" />
          <Field label="Payment channel" required>
            <View className="flex-row flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const selected = form.setup_channel === channel;
                return (
                  <Button
                    key={channel}
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    className={cn('h-10 rounded-full px-4', !selected && 'bg-transparent')}
                    onPress={() => setForm((f) => ({ ...f, setup_channel: channel }))}>
                    {selected ? <Icon as={CheckIcon} size={14} color="#04110A" /> : null}
                    <Text
                      className={cn(
                        'text-xs font-bold',
                        selected ? 'text-primary-foreground' : 'text-foreground'
                      )}>
                      {channel}
                    </Text>
                  </Button>
                );
              })}
            </View>
          </Field>
          <Field
            label="Transaction ID / Reference"
            required
            hint="Send the payment via Telebirr or CBE, then paste the transaction ID. Admin reviews it before you get access.">
            <Input
              placeholder="e.g. TB12345678"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.setup_transaction_ref}
              onChangeText={set('setup_transaction_ref')}
            />
          </Field>
        </View>
      </View>

      <Button disabled={loading} onPress={onSubmit} size="lg" className="mt-1">
        <Text className="text-sm font-semibold text-primary-foreground">
          {loading ? 'Submitting…' : 'Submit and create account'}
        </Text>
      </Button>
    </AuthShell>
  );
}
