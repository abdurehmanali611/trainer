import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
import { PhoneNumberInput } from '@/components/phone-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import type { Trainer } from '@/lib/types';

type Form = {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  gymName: string;
  threshold: string;
};

const EMPTY: Form = {
  username: '',
  fullName: '',
  email: '',
  phone: '',
  gymName: '',
  threshold: '',
};

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <View className="gap-1.5">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Input {...props} />
    </View>
  );
}

export default function ProfileScreen() {
  const { setTrainer } = useAuth();
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [avatar, setAvatar] = React.useState('');
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [fullName, setFullName] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api<Trainer>('auth/me/');
      setForm({
        username: me.username,
        fullName: me.full_name,
        email: me.email,
        phone: me.phone,
        gymName: me.gym_name,
        threshold: me.inactive_days_threshold == null ? '' : String(me.inactive_days_threshold),
      });
      setAvatar(me.avatar_url ?? '');
      setFullName(me.full_name || me.username);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function update(patch: Partial<Form>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function save() {
    if (!form.email.trim() || !form.fullName.trim()) {
      Alert.alert('Missing fields', 'Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      const threshold = form.threshold.trim();
      const updated = await api<Trainer>('auth/me/', {
        method: 'PATCH',
        body: {
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          gym_name: form.gymName.trim(),
          inactive_days_threshold: threshold === '' ? null : Math.max(1, parseInt(threshold, 10) || 7),
        },
      });
      setTrainer(updated);
      setSaved(true);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo access to set a profile picture.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadToCloudinary(result.assets[0].uri);
      const updated = await api<Trainer>('auth/me/', {
        method: 'PATCH',
        body: { avatar_url: url },
      });
      setAvatar(updated.avatar_url || url);
      setTrainer(updated);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading profile…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false}>
        <ErrorView error={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="mt-5">
        <ScreenHeader title="Profile" />
      </View>
      <View className="gap-6">
        <View className="items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Profile photo</Text>
          <Pressable
            onPress={() => void pickAvatar()}
            disabled={uploadingAvatar}
            className="relative active:opacity-80">
            <Avatar alt="Profile photo" className="size-24 ring-2 ring-primary/30">
              <AvatarImage source={{ uri: avatar }} />
              <AvatarFallback>
                <Text className="text-xl font-semibold">
                  {initials(fullName || 'Trainer')}
                </Text>
              </AvatarFallback>
            </Avatar>
            {uploadingAvatar ? (
              <View className="absolute inset-0 items-center justify-center rounded-full bg-black/45">
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : null}
          </Pressable>
          <Text variant="muted" className="text-center text-xs">
            Optional — once uploaded this picture is shown as your avatar everywhere.
          </Text>
          <View className="flex-row gap-2">
            <Button size="sm" variant="outline" disabled={uploadingAvatar} onPress={() => void pickAvatar()}>
              <Text>{avatar ? 'Change photo' : 'Upload photo'}</Text>
            </Button>
            {avatar ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={uploadingAvatar}
                onPress={async () => {
                  try {
                    const updated = await api<Trainer>('auth/me/', {
                      method: 'PATCH',
                      body: { avatar_url: '' },
                    });
                    setAvatar('');
                    setTrainer(updated);
                  } catch {
                    setAvatar('');
                  }
                }}>
                <Text>Remove</Text>
              </Button>
            ) : null}
          </View>
        </View>
        <View className="gap-4 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Account</Text>
          <Field label="Username" value={form.username} editable={false} autoCapitalize="none" />
          <Field
            label="Full name"
            value={form.fullName}
            onChangeText={(v) => update({ fullName: v })}
            autoCapitalize="words"
          />
          <Field
            label="Email"
            value={form.email}
            onChangeText={(v) => update({ email: v })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View className="gap-1.5">
            <Text variant="muted" className="text-xs">
              Phone
            </Text>
            <PhoneNumberInput value={form.phone} onChange={(v) => update({ phone: v })} />
          </View>
        </View>

        <View className="gap-4 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Trainer details</Text>
          <Field
            label="Gym name"
            value={form.gymName}
            onChangeText={(v) => update({ gymName: v })}
            autoCapitalize="words"
          />
          <Field
            label="Mark inactive after (days)"
            value={form.threshold}
            onChangeText={(v) => update({ threshold: v })}
            keyboardType="number-pad"
            placeholder="7"
          />
          <Text variant="muted" className="text-xs">
            Clients with no completed session for this many days are flagged as inactive. Leave
            empty to use the default of 7 days.
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <Button disabled={saving} onPress={() => void save()}>
            <Text>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Button>
          {saved ? <Text variant="muted">Saved</Text> : null}
        </View>
      </View>
    </Screen>
  );
}
