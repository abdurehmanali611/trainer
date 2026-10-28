import { useRouter } from 'expo-router';
import { ChevronRightIcon, PlusIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge, EmptyView, ErrorView, toneForMode } from '@/components/screen';
import { PhoneNumberInput } from '@/components/phone-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { initials, labelize, normalizeAccessState } from '@/lib/format';
import type { Client, Paginated } from '@/lib/types';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'trial', label: 'Trial' },
  { key: 'illustrative', label: 'Illustrative' },
  { key: 'blocked', label: 'Blocked' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5 sm:flex-1">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-sm font-medium text-destructive"> *</Text> : null}
      </Label>
      {children}
      {hint ? (
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function ClientRow({ client, onPress }: { client: Client; onPress: () => void }) {
  const state = normalizeAccessState(client.access_state).state;
  // A freshly created client has no subscription period yet — that is an
  // onboarding step, not a blocked account, so it gets a softer badge.
  const blocked = state === 'blocked_unpaid' || state === 'blocked_trial_expired';
  const needsPeriod = state === 'blocked_no_period';
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border-border flex-row items-center gap-3 rounded-xl border px-4 py-3 shadow-sm shadow-black/[0.05] active:bg-accent/40 dark:shadow-black/30">
      <Avatar alt={client.name}>
        <AvatarImage source={{ uri: client.avatar_url }} />
        <AvatarFallback>
          <Text className="text-xs font-medium">{initials(client.name)}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="font-medium" numberOfLines={1}>
            {client.name}
          </Text>
          {blocked ? <Badge label="Blocked" tone="danger" /> : null}
          {needsPeriod ? <Badge label="No period yet" tone="warning" /> : null}
        </View>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {client.phone || client.email}
        </Text>
      </View>
      <Badge label={labelize(client.mode)} tone={toneForMode[client.mode]} />
      <Icon as={ChevronRightIcon} className="text-muted-foreground" size={18} />
    </Pressable>
  );
}

function CreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [goals, setGoals] = React.useState('');
  const [medicalHistory, setMedicalHistory] = React.useState('');
  const [emergencyContact, setEmergencyContact] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  // Illustrative clients are not payable, so they get no payment instruction.
  const [illustration, setIllustration] = React.useState(false);
  const [instructionId, setInstructionId] = React.useState('');
  const [instructions, setInstructions] = React.useState<
    { id: number; label: string }[]
  >([]);

  React.useEffect(() => {
    if (!open) return;
    api<{ id: number; label: string }[] | { results: { id: number; label: string }[] }>(
      'payment-instructions/'
    )
      .then((res) => setInstructions(Array.isArray(res) ? res : res.results))
      .catch(() => setInstructions([]));
  }, [open]);

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setGoals('');
    setMedicalHistory('');
    setEmergencyContact('');
    setIllustration(false);
    setInstructionId('');
  }

  async function submit() {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      Alert.alert('Missing fields', 'Name, phone and email are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      const created = await api<Client>('clients/', {
        method: 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          payment_instruction:
            illustration || !instructionId ? null : Number(instructionId),
          goals: goals
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean),
          medical_history: medicalHistory.trim(),
          emergency_contact: emergencyContact.trim(),
        },
      });
      if (illustration) {
        // The create API no longer accepts a mode field; illustrative clients
        // get their mode right after creation.
        await api(`clients/${created.id}/`, { method: 'PATCH', body: { mode: 'illustrative' } });
      }
      Alert.alert(
        'Client created',
        created.otp
          ? `Share this OTP with ${created.name} so they can log in: ${created.otp}`
          : 'Client added to your list.'
      );
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      Alert.alert('Could not create client', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>Create a client account. Phone and email are required.</DialogDescription>
        </DialogHeader>
        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={{ gap: 14 }}
          showsVerticalScrollIndicator={false}>
          <View className="gap-3 sm:flex-row">
            <Field label="Full name" required>
              <Input placeholder="Abebe Bekele" value={name} onChangeText={setName} />
            </Field>
            <Field label="Phone" required>
              <PhoneNumberInput value={phone} onChange={setPhone} />
            </Field>
          </View>
          <View className="gap-3 sm:flex-row">
            <Field label="Email" required>
              <Input
                placeholder="client@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </Field>
          </View>

          <View className="gap-3 rounded-xl border border-border bg-card p-3.5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium">Illustration</Text>
                <Text variant="muted" className="text-xs">
                  On = this client is not payable (no payment instruction is shown to them).
                </Text>
              </View>
              <Switch checked={illustration} onCheckedChange={setIllustration} />
            </View>
            {!illustration ? (
              <View className="gap-1.5">
                <Text variant="muted" className="text-xs font-medium">
                  Payment instruction
                </Text>
                <Combobox
                  value={instructionId}
                  onValueChange={setInstructionId}
                  options={instructions.map((item) => ({
                    value: String(item.id),
                    label: item.label,
                  }))}
                  placeholder="No payment instruction"
                  searchPlaceholder="Search instructions…"
                  align="left"
                  emptyText="Create one in Billing → Payment instructions."
                  className="w-full"
                />
              </View>
            ) : null}
          </View>

          <Field label="Goals" hint="Comma separated, e.g. weight loss, strength.">
            <Input
              placeholder="Weight loss, strength"
              value={goals}
              onChangeText={setGoals}
            />
          </Field>
          <Field label="Medical history" hint="Optional.">
            <Textarea
              placeholder="Injuries, conditions, medications…"
              value={medicalHistory}
              onChangeText={setMedicalHistory}
            />
          </Field>
          <Field label="Emergency contact" hint="Optional — name and phone number.">
            <Input
              placeholder="e.g. Sara Bekele +251 911 234 567"
              value={emergencyContact}
              onChangeText={setEmergencyContact}
            />
          </Field>
        </ScrollView>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onPress={() => onOpenChange(false)}>
            <Text>Cancel</Text>
          </Button>
          <Button disabled={saving} onPress={submit}>
            <Text>{saving ? 'Creating…' : 'Create client'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [query, setQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [items, setItems] = React.useState<Client[]>([]);
  const [count, setCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const pageRef = React.useRef(1);
  const seqRef = React.useRef(0);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const modeParam = filter === 'paid' || filter === 'trial' || filter === 'illustrative' ? filter : undefined;
  const accessParam = filter === 'blocked' ? 'blocked' : undefined;

  const load = React.useCallback(
    async (kind: 'initial' | 'refresh' | 'more') => {
      const seq = ++seqRef.current;
      const page = kind === 'more' ? pageRef.current + 1 : 1;
      if (kind === 'initial') setLoading(true);
      if (kind === 'refresh') setRefreshing(true);
      if (kind === 'more') setLoadingMore(true);
      try {
        const res = await api<Paginated<Client>>('clients/', {
          query: {
            page,
            search: debouncedSearch || undefined,
            mode: modeParam,
            access: accessParam,
          },
        });
        if (seq !== seqRef.current) return;
        pageRef.current = page;
        setCount(res.count);
        setHasMore(res.next !== null);
        setItems((prev) => (page === 1 ? res.results : [...prev, ...res.results]));
        setError(null);
      } catch (e) {
        if (seq !== seqRef.current) return;
        setError(e instanceof Error ? e.message : 'Could not load clients.');
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedSearch, modeParam, accessParam]
  );

  React.useEffect(() => {
    load('initial');
  }, [load]);

  const header = (
    <View className="gap-5 pb-4">
      <AppHeader />
      <View className="flex-row items-end justify-center gap-2">
        <Input
          className="h-11 w-64 rounded-xl"
          placeholder="Search name, phone or email…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View className="items-end gap-2">
          <Button
            size="lg"
            onPress={() => setCreateOpen(true)}
            className="h-11 rounded-xl px-4">
            <Icon as={PlusIcon} size={18} />
            <Text>Add client</Text>
          </Button>
          <Combobox
            value={filter}
            onValueChange={(value) => setFilter(value as FilterKey)}
            options={FILTERS.map((f) => ({ value: f.key, label: f.label }))}
            placeholder="Filter"
            searchPlaceholder="Filter clients…"
            className="w-44"
          />
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ClientRow client={item} onPress={() => router.push(`/client/${item.id}`)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View className="gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </View>
          ) : error ? (
            <ErrorView error={error} onRetry={() => load('initial')} />
          ) : (
            <EmptyView
              title="No clients yet"
              subtitle={debouncedSearch || filter !== 'all' ? 'No clients match your filters.' : 'Add your first client to get started.'}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4">
              <ActivityIndicator />
            </View>
          ) : undefined
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 8 + 8,
          paddingBottom: 120,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && !loadingMore && hasMore) load('more');
        }}
        refreshing={refreshing}
        onRefresh={() => load('refresh')}
      />
      <View className="absolute bottom-6 right-4">
        <View className="rounded-full border border-border bg-card px-4 py-2 shadow-lg shadow-black/10">
          <Text variant="muted" className="text-xs font-medium">
            {count != null ? `${count} total` : ''}
          </Text>
        </View>
      </View>
      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => load('refresh')} />
    </View>
  );
}
