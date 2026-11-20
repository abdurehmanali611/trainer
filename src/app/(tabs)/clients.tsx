import { useRouter } from 'expo-router';
import { ChevronRightIcon, HeartPulseIcon, PlusIcon, SearchIcon, Trash2Icon, UserIcon, UsersIcon, WalletIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { alpha, Chip, COLORS, Panel } from '@/components/kit';
import { EmptyView, ErrorView } from '@/components/screen';
import { PhoneNumberInput } from '@/components/phone-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogSection,
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
import { initials, joinEmergencyContact } from '@/lib/format';
import type { Client, Paginated } from '@/lib/types';

// The seven list filters. They overlap on purpose: a paid client is also active,
// and a deactivated client still shows under All.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'illustration', label: 'Illustration' },
  { key: 'deactivated', label: 'Deactivated' },
  { key: 'blocked', label: 'Blocked' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const KIND_COLOR: Record<string, string> = {
  paid: COLORS.green,
  trial: COLORS.violet,
  discount: COLORS.amber,
  illustration: COLORS.pink,
};

const KIND_LABEL: Record<string, string> = {
  paid: 'Paid',
  trial: 'Trial',
  discount: 'Discount',
  illustration: 'Illustration',
};

const FILTER_COLOR: Record<FilterKey, string> = {
  all: COLORS.cyan,
  paid: COLORS.green,
  active: COLORS.lime,
  trial: COLORS.violet,
  illustration: COLORS.pink,
  deactivated: COLORS.muted,
  blocked: COLORS.rose,
};

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

function ClientRow({ client, onPress, onDelete }: { client: Client; onPress: () => void; onDelete: (client: Client) => void }) {
  const kind = client.status_kind ?? (client.mode === 'illustrative' ? 'illustration' : 'paid');
  const blocked = client.is_blocked === true;
  const accent = blocked ? COLORS.rose : (KIND_COLOR[kind] ?? COLORS.green);
  return (
    <Panel
      onPress={onPress}
      tint={client.is_active ? accent : undefined}
      className="flex-row items-center gap-3 p-3.5">
      <View
        style={{
          padding: 2,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: alpha(accent, client.is_active ? 0.9 : 0.3),
        }}>
        <Avatar alt={client.name} className="h-11 w-11">
          <AvatarImage source={{ uri: client.avatar_url }} />
          <AvatarFallback>
            <Text className="text-sm font-black" style={{ color: accent }}>
              {initials(client.name)}
            </Text>
          </AvatarFallback>
        </Avatar>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text
          className={client.is_active ? 'text-[15px] font-bold' : 'text-[15px] font-bold opacity-60'}
          numberOfLines={1}>
          {client.name}
        </Text>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {client.phone || client.email}
        </Text>
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Chip label={KIND_LABEL[kind] ?? 'Paid'} color={KIND_COLOR[kind] ?? COLORS.green} />
          {/* Feature 18: deactivated clients stay listed, marked inactive. */}
          {!client.is_active ? <Chip label="Inactive" color={COLORS.muted} /> : null}
          {blocked ? <Chip label="Blocked" color={COLORS.rose} /> : null}
        </View>
      </View>
      {/* Feature 19: the trash icon removes the client completely —
          sessions, periods, payments, chat, diary, plans, everything. */}
      <Pressable
        hitSlop={10}
        onPress={() => onDelete(client)}
        className="rounded-xl p-2 active:bg-destructive/10">
        <Icon as={Trash2Icon} size={17} color={COLORS.rose} />
      </Pressable>
      <Icon as={ChevronRightIcon} size={18} color={COLORS.muted} />
    </Panel>
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
  const [emergencyName, setEmergencyName] = React.useState('');
  const [emergencyPhone, setEmergencyPhone] = React.useState('');
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
    setEmergencyName('');
    setEmergencyPhone('');
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
    if (!illustration && !instructionId) {
      Alert.alert(
        'Payment instruction required',
        'Choose a payment instruction, or turn on "Not payable" to make this an illustration client.'
      );
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
          illustration,
          payment_instruction: illustration ? null : Number(instructionId),
          goals: goals
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean),
          medical_history: medicalHistory.trim(),
          emergency_contact: joinEmergencyContact(emergencyName, emergencyPhone),
        },
      });
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
        <DialogBody contentContainerClassName="gap-4">
          <DialogSection icon={UserIcon} label="Client details" className="gap-3">
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
          </DialogSection>

          <DialogSection
            icon={WalletIcon}
            label="Illustration"
            className={illustration ? 'border-primary/40 bg-primary/5' : undefined}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium">Not payable (illustration client)</Text>
                <Text variant="muted" className="text-xs">
                  On = this client never pays and is never asked to. Off = pick how they pay below (required).
                </Text>
              </View>
              <Switch checked={illustration} onCheckedChange={setIllustration} />
            </View>
            {!illustration ? (
              <View className="gap-1.5">
                <Text variant="muted" className="text-xs font-medium">
                  Payment instruction (required)
                </Text>
                <Combobox
                  value={instructionId}
                  onValueChange={setInstructionId}
                  options={instructions.map((item) => ({
                    value: String(item.id),
                    label: item.label,
                  }))}
                  placeholder="Pick a payment instruction"
                  searchPlaceholder="Search instructions…"
                  align="left"
                  emptyText="Create one in Billing → Payment instructions."
                  className="w-full"
                />
              </View>
            ) : null}
          </DialogSection>

          <DialogSection icon={HeartPulseIcon} label="Health & safety" className="gap-3">
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
            <View className="gap-3 sm:flex-row">
              <Field label="Emergency name" hint="Optional.">
                <Input
                  placeholder="e.g. Sara Bekele"
                  value={emergencyName}
                  onChangeText={setEmergencyName}
                />
              </Field>
              <Field label="Emergency phone" hint="Optional.">
                <PhoneNumberInput value={emergencyPhone} onChange={setEmergencyPhone} />
              </Field>
            </View>
          </DialogSection>
        </DialogBody>
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
            // The server applies the filter (it knows who is in a trial, on a
            // discount, blocked, …); All also includes deactivated clients.
            bucket: filter,
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
    [debouncedSearch, filter]
  );

  React.useEffect(() => {
    load('initial');
  }, [load]);

  const header = (
    <View className="gap-4 pb-4">
      <AppHeader />
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[28px] font-black tracking-tight">Clients</Text>
          <Text variant="muted" className="text-[13px]">
            {count != null ? `${count} on your roster` : 'Your roster'}
          </Text>
        </View>
        <Pressable
          onPress={() => setCreateOpen(true)}
          accessibilityRole="button"
          className="h-12 flex-row items-center gap-2 rounded-2xl px-4 active:opacity-80"
          style={{ backgroundColor: COLORS.green }}>
          <Icon as={PlusIcon} size={18} color="#04110A" />
          <Text className="text-sm font-black" style={{ color: '#04110A' }}>
            Add client
          </Text>
        </Pressable>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 justify-center">
          <Input
            className="h-12 rounded-2xl pl-11"
            placeholder="Search name, phone or email…"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View pointerEvents="none" className="absolute left-4">
            <Icon as={SearchIcon} size={18} color={COLORS.muted} />
          </View>
        </View>
      </View>
      {/* Fixed height + no shrink so the row is never squashed, and it scrolls
          sideways with a finger (native) or the wheel / trackpad (web). */}
      <View style={{ height: 44, flexGrow: 0, flexShrink: 0, marginHorizontal: -20 }}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, alignItems: 'center' }}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          const color = FILTER_COLOR[f.key];
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="h-10 items-center justify-center rounded-full px-4 active:opacity-80"
              style={{
                backgroundColor: active ? color : alpha(color, 0.1),
                borderWidth: 1,
                borderColor: active ? color : alpha(color, 0.3),
              }}>
              <Text className="text-[13px] font-extrabold" style={{ color: active ? '#04110A' : color }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ClientRow
            client={item}
            onPress={() => router.push(`/client/${item.id}`)}
            onDelete={(client) => {
              // Feature 19: permanent delete — confirm the permanence first.
              Alert.alert(
                'Delete client permanently?',
                `${client.name} will be removed completely — all in all: sessions, ` +
                  'subscription periods, payments, chat, diary and plans are erased. ' +
                  'They can only come back as a brand-new client with a new OTP.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete forever',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api(`clients/${client.id}/`, { method: 'DELETE' });
                        setItems((prev) => prev.filter((c) => c.id !== client.id));
                        setCount((c) => (c != null ? Math.max(0, c - 1) : c));
                      } catch (e) {
                        Alert.alert(
                          'Delete failed',
                          e instanceof Error ? e.message : 'Something went wrong.'
                        );
                      }
                    },
                  },
                ]
              );
            }}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View className="gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-3xl" />
              ))}
            </View>
          ) : error ? (
            <ErrorView error={error} onRetry={() => load('initial')} />
          ) : (
            <EmptyView
              icon={UsersIcon}
              color={COLORS.cyan}
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
        {count != null ? <Chip label={`${count} total`} color={COLORS.cyan} /> : null}
      </View>
      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => load('refresh')} />
    </View>
  );
}
