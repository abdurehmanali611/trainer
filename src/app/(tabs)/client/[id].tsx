import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { DumbbellIcon, MessageCircleIcon, PencilIcon, SaladIcon, TargetIcon, Trash2Icon, WalletIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PhoneNumberInput } from '@/components/phone-input';
import {
  Badge,
  ErrorView,
  LoadingView,
  Screen,
  toneForInvoice,
  toneForMode,
} from '@/components/screen';
import { Button } from '@/components/ui/button';
import { DatePopoverField } from '@/components/ui/calendar';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type Option,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { relativeTime, shortDate } from '@/lib/dates';
import {
  formatMoney,
  initials,
  joinEmergencyContact,
  labelize,
  normalizeAccessState,
  splitEmergencyContact,
} from '@/lib/format';
import type {
  AccessState,
  Client,
  ClientMode,
  Invoice,
  Payment,
  Paginated,
  SubscriptionPeriod,
} from '@/lib/types';

const MODE_OPTIONS: { value: ClientMode; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'trial', label: 'Trial' },
  { value: 'illustrative', label: 'Illustrative' },
];

const ACCESS_META: Record<
  AccessState['state'],
  { label: string; tone: 'success' | 'danger' | 'warning'; explain: string }
> = {
  allowed: {
    label: 'Access allowed',
    tone: 'success',
    explain: 'This client can log in and use the app.',
  },
  blocked_unpaid: {
    label: 'Blocked — unpaid',
    tone: 'danger',
    explain: 'Access is blocked until the latest invoice is approved or forgiven.',
  },
  blocked_no_period: {
    label: 'No period yet',
    tone: 'warning',
    explain: 'New client — add a subscription period below to activate their access.',
  },
  blocked_trial_expired: {
    label: 'Blocked — trial expired',
    tone: 'danger',
    explain: 'The free trial is over. Add a paid period or approve an invoice to restore access.',
  },
};

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  mode: Option;
  goals: string;
  medical_history: string;
  emergency_name: string;
  emergency_phone: string;
  current_weight: string;
  target_weight: string;
  body_fat: string;
}

function formFromClient(client: Client): ClientForm {
  // NOTE: destructure deliberately — the helper returns { name, phone } and a
  // naive spread here would clobber the client's own name/phone fields.
  const { name: emergencyName, phone: emergencyPhone } = splitEmergencyContact(
    client.emergency_contact
  );
  return {
    name: client.name,
    phone: client.phone,
    email: client.email,
    mode: { value: client.mode, label: labelize(client.mode) },
    goals: client.goals.join(', '),
    medical_history: client.medical_history ?? '',
    emergency_name: emergencyName,
    emergency_phone: emergencyPhone,
    current_weight: client.current_weight != null ? String(client.current_weight) : '',
    target_weight: client.target_weight != null ? String(client.target_weight) : '',
    body_fat: client.body_fat != null ? String(client.body_fat) : '',
  };
}

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text variant="muted" className="text-xs font-medium">
        {label}
      </Text>
      {children}
    </View>
  );
}

const TILE_TONES: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
  warning: 'bg-amber-500/12 text-amber-600 ring-amber-500/30 dark:text-amber-300',
  danger: 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-300',
  info: 'bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-300',
};

const TILE_ICON_COLORS: Record<string, string> = {
  success: 'text-emerald-600 dark:text-emerald-300',
  warning: 'text-amber-600 dark:text-amber-300',
  danger: 'text-rose-600 dark:text-rose-300',
  info: 'text-sky-600 dark:text-sky-300',
};

function StatusTile({
  icon,
  label,
  value,
  caption,
  tone = 'info',
}: {
  icon: typeof TargetIcon;
  label: string;
  value: string;
  caption?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneClass = TILE_TONES[tone] ?? TILE_TONES.info;
  const iconColor = TILE_ICON_COLORS[tone] ?? TILE_ICON_COLORS.info;
  return (
    <View className="w-[48%] gap-1.5 rounded-xl border border-border bg-card p-3 shadow-sm shadow-black/[0.04] dark:shadow-black/30">
      <View className="flex-row items-center gap-2">
        <View className={`h-7 w-7 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
          <Icon as={icon} size={14} className={iconColor} />
        </View>
        <Text variant="muted" className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </Text>
      </View>
      <Text className="text-sm font-semibold" numberOfLines={1}>
        {value}
      </Text>
      {caption ? (
        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card border-border gap-4 rounded-xl border p-4">
      <Text className="text-base font-semibold">{title}</Text>
      {children}
    </View>
  );
}

function PaymentRow({
  payment,
  busy,
  onApprove,
  onReject,
}: {
  payment: Payment;
  busy: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const tone =
    payment.status === 'approved'
      ? 'success'
      : payment.status === 'rejected'
        ? 'danger'
        : payment.status === 'forgiven'
          ? 'default'
          : 'warning';
  return (
    <View className="bg-muted/50 flex-row items-center justify-between gap-2 rounded-md px-2.5 py-2">
      <View className="flex-1 gap-0.5">
        <Text className="text-xs">
          {labelize(payment.channel)} · {payment.transaction_id || '—'}
        </Text>
        <Text variant="muted" className="text-xs">
          {relativeTime(payment.created_at)}
        </Text>
      </View>
      {payment.status === 'pending' ? (
        <View className="flex-row gap-1.5">
          <Button size="sm" variant="outline" disabled={busy} onPress={() => onApprove(payment.id)}>
            <Text className="text-xs">Approve</Text>
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onPress={() => onReject(payment.id)}>
            <Text className="text-xs">Reject</Text>
          </Button>
        </View>
      ) : (
        <Badge label={labelize(payment.status)} tone={tone} />
      )}
    </View>
  );
}

function InvoiceCard({
  invoice,
  busy,
  onApprove,
  onReject,
  onForgive,
}: {
  invoice: Invoice;
  busy: boolean;
  onApprove: (paymentId: number) => void;
  onReject: (paymentId: number) => void;
  onForgive: (invoiceId: number) => void;
}) {
  return (
    <View className="border-border gap-2.5 rounded-lg border p-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-medium">{formatMoney(invoice.amount)}</Text>
        <Badge label={labelize(invoice.status)} tone={toneForInvoice[invoice.status]} />
      </View>
      <Text variant="muted" className="text-xs">
        {invoice.status === 'overdue'
          ? `Was due ${shortDate(invoice.due_date)}`
          : invoice.status === 'pending'
            ? `Due ${shortDate(invoice.due_date)}`
            : `Due date ${shortDate(invoice.due_date)}`}
        {invoice.paid_at ? ` · paid ${shortDate(invoice.paid_at)}` : ''}
      </Text>
      {invoice.payments.map((p) => (
        <PaymentRow key={p.id} payment={p} busy={busy} onApprove={onApprove} onReject={onReject} />
      ))}
      {invoice.status === 'pending' || invoice.status === 'overdue' ? (
        <Button size="sm" variant="ghost" disabled={busy} onPress={() => onForgive(invoice.id)}>
          <Text className="text-xs">Forgive invoice</Text>
        </Button>
      ) : null}
    </View>
  );
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { trainer } = useAuth();
  const [client, setClient] = React.useState<Client | null>(null);
  const [periods, setPeriods] = React.useState<SubscriptionPeriod[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [workoutPlanCount, setWorkoutPlanCount] = React.useState(0);
  const [dietPlanCount, setDietPlanCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setFormState] = React.useState<ClientForm | null>(null);
  // True while the trainer has unsaved edits in the form — the form must not
  // be re-hydrated over their typing when the client refetches.
  const formDirtyRef = React.useRef(false);
  const setForm = React.useCallback<typeof setFormState>((updater) => {
    formDirtyRef.current = true;
    return setFormState(updater);
  }, []);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [resettingOtp, setResettingOtp] = React.useState(false);
  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [periodTrial, setPeriodTrial] = React.useState(false);
  const [periodAmount, setPeriodAmount] = React.useState('');
  const [savingPeriod, setSavingPeriod] = React.useState(false);
  // Feature 9: when set, the Add-period form is in EDIT mode for this row.
  const [editingPeriod, setEditingPeriod] = React.useState<SubscriptionPeriod | null>(null);

  const loadAll = React.useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true);
      try {
        const [detail, periodRes, invoiceRes, workoutRes, dietRes] = await Promise.all([
          api<Client>(`clients/${id}/`),
          api<Paginated<SubscriptionPeriod> | SubscriptionPeriod[]>('periods/', { query: { client: id } }),
          api<Paginated<Invoice> | Invoice[]>('invoices/', { query: { client: id } }),
          api<Paginated<unknown> | unknown[]>('workout-plans/', { query: { client: id } }),
          api<Paginated<unknown> | unknown[]>('diet-plans/', { query: { client: id } }),
        ]);
        setClient(detail);
        setPeriods(Array.isArray(periodRes) ? periodRes : periodRes.results);
        setInvoices(Array.isArray(invoiceRes) ? invoiceRes : invoiceRes.results);
        setWorkoutPlanCount(
          Array.isArray(workoutRes) ? workoutRes.length : (workoutRes.count ?? workoutRes.results?.length ?? 0)
        );
        setDietPlanCount(
          Array.isArray(dietRes) ? dietRes.length : (dietRes.count ?? dietRes.results?.length ?? 0)
        );
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load client.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Re-hydrate the form whenever fresher client data arrives, unless the
  // trainer is mid-edit. Without this the form kept its first snapshot
  // forever, so saved changes (e.g. emergency contact) never appeared.
  React.useEffect(() => {
    if (client && !formDirtyRef.current) setFormState(formFromClient(client));
  }, [client]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to update the client photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(result.assets[0].uri);
      const updated = await api<Client>(`clients/${id}/`, { method: 'PATCH', body: { avatar_url: url } });
      setClient(updated);
      if (!formDirtyRef.current) setFormState(formFromClient(updated));
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      Alert.alert('Missing fields', 'Name, phone and email are required.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api<Client>(`clients/${id}/`, {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          mode: form.mode?.value ?? 'paid',
          goals: form.goals
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean),
          medical_history: form.medical_history,
          emergency_contact: joinEmergencyContact(form.emergency_name, form.emergency_phone),
          current_weight: parseNum(form.current_weight),
          target_weight: parseNum(form.target_weight),
          body_fat: parseNum(form.body_fat),
        },
      });
      setClient(updated);
      // Rebuild the form from the server's response so it reflects exactly
      // what was stored (normalises the emergency contact split too).
      formDirtyRef.current = false;
      setFormState(formFromClient(updated));
      Alert.alert('Saved', 'Client profile updated.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  function startEditPeriod(p: SubscriptionPeriod) {
    // Feature 9: reuse the Add-period form as an editor.
    setEditingPeriod(p);
    setPeriodStart(p.start_date);
    setPeriodEnd(p.end_date);
    setPeriodTrial(p.is_trial);
    setPeriodAmount(p.is_trial ? '0' : String(Number(p.amount)));
  }

  function cancelEditPeriod() {
    setEditingPeriod(null);
    setPeriodStart('');
    setPeriodEnd('');
    setPeriodTrial(false);
    setPeriodAmount('');
  }

  function deletePeriod(p: SubscriptionPeriod) {
    Alert.alert(
      'Delete period',
      `Delete ${shortDate(p.start_date)} → ${shortDate(p.end_date)}? ` +
        'Its pending invoice is removed too (paid/forgiven history is kept).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSavingPeriod(true);
            try {
              await api(`periods/${p.id}/`, { method: 'DELETE' });
              await loadAll(true);
            } catch (e) {
              Alert.alert(
                'Could not delete period',
                e instanceof Error ? e.message : 'Something went wrong.'
              );
            } finally {
              setSavingPeriod(false);
            }
          },
        },
      ]
    );
  }

  async function addPeriod() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      Alert.alert('Invalid dates', 'Use YYYY-MM-DD format for start and end dates.');
      return;
    }
    // Feature 8: paid periods must be > 0 (trial amounts are forced to 0 and
    // the field is disabled, so this only ever runs for paid periods).
    const amountValue = Number(periodAmount.trim());
    if (!periodTrial && (!periodAmount.trim() || !Number.isFinite(amountValue) || amountValue <= 0)) {
      Alert.alert('Invalid amount', 'A paid period needs an amount greater than 0.');
      return;
    }
    const editing = editingPeriod !== null;
    setSavingPeriod(true);
    try {
      const body = {
        start_date: periodStart,
        end_date: periodEnd,
        is_trial: periodTrial,
        amount: periodTrial ? '0' : periodAmount.trim(),
      };
      if (editing) {
        // Feature 9: PATCH the saved row (partial — package stays untouched).
        await api(`periods/${editingPeriod!.id}/`, { method: 'PATCH', body });
        Alert.alert('Period updated', 'The subscription period was saved.');
        cancelEditPeriod();
      } else {
        await api('periods/', {
          method: 'POST',
          // The backend reads `client_id` (and optional `package_id`), not `client`.
          body: { client_id: Number(id), ...body },
        });
        Alert.alert('Period added', 'The subscription period was created.');
        setPeriodStart('');
        setPeriodEnd('');
        setPeriodTrial(false);
        setPeriodAmount('');
      }
      await loadAll(true);
    } catch (e) {
      Alert.alert(
        editing ? 'Could not update period' : 'Could not add period',
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setSavingPeriod(false);
    }
  }

  async function decidePayment(paymentId: number, approve: boolean) {
    const payment = invoices.flatMap((inv) => inv.payments).find((p) => p.id === paymentId);
    setBusy(true);
    try {
      await api(`payments/${paymentId}/decide/`, {
        method: 'POST',
        body: approve ? { approve: true, channel: payment?.channel } : { approve: false },
      });
      await loadAll(true);
    } catch (e) {
      Alert.alert('Action failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function forgiveInvoice(invoiceId: number) {
    Alert.alert('Forgive invoice?', 'It will be marked as forgiven and the client will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forgive',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api(`invoices/${invoiceId}/forgive/`, { method: 'POST', body: {} });
            await loadAll(true);
          } catch (e) {
            Alert.alert('Action failed', e instanceof Error ? e.message : 'Something went wrong.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function toggleActive() {
    if (!client) return;
    // Feature 18: deactivate/reactivate is a SOFT toggle — the client stays
    // listed (inactive), keeps every data row and their OTP untouched.
    const nextActive = !client.is_active;
    setBusy(true);
    try {
      const updated = await api<Client>(`clients/${id}/`, {
        method: 'PATCH',
        body: { is_active: nextActive },
      });
      setClient(updated);
      Alert.alert(
        nextActive ? 'Client reactivated' : 'Client deactivated',
        nextActive
          ? 'They can log in again with the same OTP and get sessions assigned.'
          : 'They stay in your list (inactive), cannot log in or be assigned sessions. Their data is kept.'
      );
    } catch (e) {
      Alert.alert('Action failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !client) return <LoadingView label="Loading client…" />;
  if (error && !client) return <ErrorView error={error} onRetry={() => loadAll()} />;
  if (!client || !form) return null;

  const accessState = normalizeAccessState(client.access_state);
  const access = ACCESS_META[accessState.state] ?? ACCESS_META.allowed;
  const unpaidCount = invoices.filter(
    (inv) => inv.status === 'pending' || inv.status === 'overdue'
  ).length;
  const lastPeriod = periods[0] ?? null;
  const paymentInstructions: [string, string][] = trainer
    ? ([
        ['Telebirr number', trainer.telebirr_number],
        ['Bank name', trainer.bank_name],
        ['Account name', trainer.bank_account_name],
        ['Account number', trainer.bank_account_number],
        ['Cash note', trainer.cash_note],
      ] as [string, string][]).filter(([, value]) => value.trim().length > 0)
    : [];
  const hasInstructions = paymentInstructions.length > 0;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => loadAll(true)}
      topGap={8}
      showHeader={false}>
      <View className="mb-6 items-center gap-3">
        <Pressable onPress={pickAvatar} disabled={uploading} className="items-center">
          <Avatar alt={client.name} className="size-20">
            <AvatarImage source={{ uri: client.avatar_url }} />
            <AvatarFallback>
              <Text className="text-lg font-semibold">{initials(client.name)}</Text>
            </AvatarFallback>
          </Avatar>
          {uploading ? (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : null}
        </Pressable>
        <View className="items-center gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-semibold">{client.name}</Text>
            {/* Feature 18: inactive clients are visibly marked. */}
            {!client.is_active ? <Badge label="Inactive" tone="default" /> : null}
            <Badge label={labelize(client.mode)} tone={toneForMode[client.mode]} />
          </View>
          <Text variant="muted" className="text-xs">
            {client.phone} · {client.email}
          </Text>
        </View>
        <Button variant="outline" size="sm" onPress={() => router.push(`/chat/${id}`)}>
          <Icon as={MessageCircleIcon} size={16} />
          <Text className="text-sm">Open chat</Text>
        </Button>
      </View>

      <View className="gap-4">
        <View className="bg-card border-border gap-2 rounded-xl border p-4">
          <Badge label={access.label} tone={access.tone} />
          <Text variant="muted" className="text-xs">
            {accessState.reason || access.explain}
          </Text>
          {client.first_login_at ? (
            // Feature 4/5: client has logged in at least once — the OTP is no
            // longer returned; offer a Reset that issues a fresh one.
            <Button
              variant="outline"
              size="sm"
              disabled={resettingOtp}
              onPress={() =>
                Alert.alert(
                  'Reset login OTP',
                  `A new OTP will be generated for ${client.name} and the current one stops working. Continue?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        setResettingOtp(true);
                        try {
                          const res = await api<{ otp: string }>(`clients/${id}/otp/`, {
                            method: 'POST',
                          });
                          setClient((c) => (c ? { ...c, otp: res.otp, first_login_at: null } : c));
                          Alert.alert(
                            'New OTP',
                            `Share this OTP with ${client.name}: ${res.otp}`
                          );
                        } catch (e) {
                          Alert.alert(
                            'Reset failed',
                            e instanceof Error ? e.message : 'Something went wrong.'
                          );
                        } finally {
                          setResettingOtp(false);
                        }
                      },
                    },
                  ]
                )
              }>
              <Text className="text-sm">Reset login OTP</Text>
            </Button>
          ) : client.otp ? (
            <Text variant="muted" className="text-xs">
              Login OTP: {client.otp}
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold">Status</Text>
          <View className="flex-row flex-wrap gap-2.5">
            <StatusTile
              icon={TargetIcon}
              label="Goal"
              value={client.goal_label || '—'}
              caption={
                client.target_weight != null
                  ? `Target ${client.target_weight} kg`
                  : 'No target weight set'
              }
              tone="info"
            />
            <StatusTile
              icon={DumbbellIcon}
              label="Workout"
              value={
                workoutPlanCount > 0
                  ? `${workoutPlanCount} plan${workoutPlanCount === 1 ? '' : 's'}`
                  : 'No plan yet'
              }
              caption="Assigned workout plans"
              tone={workoutPlanCount > 0 ? 'success' : 'warning'}
            />
            <StatusTile
              icon={SaladIcon}
              label="Diet"
              value={
                dietPlanCount > 0
                  ? `${dietPlanCount} plan${dietPlanCount === 1 ? '' : 's'}`
                  : 'No plan yet'
              }
              caption="Assigned diet plans"
              tone={dietPlanCount > 0 ? 'success' : 'warning'}
            />
            <StatusTile
              icon={WalletIcon}
              label="Payment"
              value={
                unpaidCount > 0
                  ? `${unpaidCount} unpaid invoice${unpaidCount === 1 ? '' : 's'}`
                  : periods.length > 0
                    ? 'All settled'
                    : 'No billing yet'
              }
              caption={
                lastPeriod
                  ? `Period ${shortDate(lastPeriod.start_date)} → ${shortDate(lastPeriod.end_date)}`
                  : 'Add a subscription period below'
              }
              tone={unpaidCount > 0 ? 'danger' : periods.length > 0 ? 'success' : 'warning'}
            />
          </View>
        </View>

        <Section title="Profile">
          <View className="gap-3">
            <Field label="Name">
              <Input value={form.name} onChangeText={(v) => setForm((f) => (f ? { ...f, name: v } : f))} />
            </Field>
            <Field label="Phone">
              <PhoneNumberInput
                value={form.phone}
                onChange={(v) => setForm((f) => (f ? { ...f, phone: v } : f))}
              />
            </Field>
            <Field label="Email">
              <Input
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={form.email}
                onChangeText={(v) => setForm((f) => (f ? { ...f, email: v } : f))}
              />
            </Field>
            <Field label="Mode">
              <Select
                value={form.mode}
                onValueChange={(opt) => setForm((f) => (f ? { ...f, mode: opt } : f))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} label={opt.label} />
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Goals (comma separated)">
              <Input
                value={form.goals}
                onChangeText={(v) => setForm((f) => (f ? { ...f, goals: v } : f))}
              />
            </Field>
            <Field label="Medical history">
              <Textarea
                value={form.medical_history}
                onChangeText={(v) => setForm((f) => (f ? { ...f, medical_history: v } : f))}
              />
            </Field>
            <Field label="Emergency name">
              <Input
                value={form.emergency_name}
                onChangeText={(v) => setForm((f) => (f ? { ...f, emergency_name: v } : f))}
              />
            </Field>
            <Field label="Emergency phone">
              <PhoneNumberInput
                value={form.emergency_phone}
                onChange={(v) => setForm((f) => (f ? { ...f, emergency_phone: v } : f))}
              />
            </Field>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Weight (kg)">
                  <Input
                    keyboardType="decimal-pad"
                    value={form.current_weight}
                    onChangeText={(v) => setForm((f) => (f ? { ...f, current_weight: v } : f))}
                  />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Target (kg)">
                  <Input
                    keyboardType="decimal-pad"
                    value={form.target_weight}
                    onChangeText={(v) => setForm((f) => (f ? { ...f, target_weight: v } : f))}
                  />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Body fat %">
                  <Input
                    keyboardType="decimal-pad"
                    value={form.body_fat}
                    onChangeText={(v) => setForm((f) => (f ? { ...f, body_fat: v } : f))}
                  />
                </Field>
              </View>
            </View>
            <Button disabled={saving} onPress={save}>
              <Text>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Button>
          </View>
        </Section>

        <Section title="Subscription">
          <View className="gap-2">
            {periods.length === 0 ? (
              <Text variant="muted" className="text-sm">
                No subscription periods yet.
              </Text>
            ) : (
              periods.slice(0, 5).map((p) => (
                <View
                  key={p.id}
                  className="border-border flex-row items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm">
                      {shortDate(p.start_date)} → {shortDate(p.end_date)}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      {formatMoney(p.amount)}
                      {p.package_name ? ` · ${p.package_name}` : ''}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    {p.is_trial ? <Badge label="Trial" tone="info" /> : null}
                    {/* Feature 9: edit reuses the Add-period form; delete asks first. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={savingPeriod}
                      onPress={() => startEditPeriod(p)}>
                      <Icon as={PencilIcon} size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={savingPeriod}
                      onPress={() => deletePeriod(p)}>
                      <Icon as={Trash2Icon} size={16} className="text-destructive" />
                    </Button>
                  </View>
                </View>
              ))
            )}
          </View>

          <Separator />

          <View className="gap-3">
            <Text className="text-sm font-medium">
              {editingPeriod ? 'Edit period' : 'Add period'}
            </Text>
            <View className="flex-row gap-3">
              <DatePopoverField
                label="Start date"
                value={periodStart}
                onChange={setPeriodStart}
                placeholder="Pick a date"
                className="flex-1"
              />
              <DatePopoverField
                label="End date"
                value={periodEnd}
                onChange={setPeriodEnd}
                placeholder="Pick a date"
                className="flex-1"
              />
            </View>
            <Field label="Amount">
              <Input
                keyboardType="decimal-pad"
                value={periodAmount}
                onChangeText={setPeriodAmount}
                // Feature 8: a free trial is always 0 and cannot be edited.
                editable={!periodTrial}
                placeholder={periodTrial ? '0 (free trial)' : 'Amount'}
              />
            </Field>
            <View className="flex-row items-center justify-between">
              <Text variant="muted" className="text-sm">
                Free trial period
              </Text>
              <Switch
                checked={periodTrial}
                onCheckedChange={(checked) => {
                  setPeriodTrial(checked);
                  // Feature 8: turning the trial ON forces the amount to 0.
                  if (checked) setPeriodAmount('0');
                }}
              />
            </View>
            <Button variant="outline" disabled={savingPeriod} onPress={addPeriod}>
              <Text>
                {savingPeriod
                  ? 'Saving…'
                  : editingPeriod
                    ? 'Save period'
                    : 'Add period'}
              </Text>
            </Button>
            {editingPeriod ? (
              <Button variant="ghost" disabled={savingPeriod} onPress={cancelEditPeriod}>
                <Text>Cancel edit</Text>
              </Button>
            ) : null}
          </View>

          <Separator />

          <View className="gap-2">
            <Text className="text-sm font-medium">Payment instructions</Text>
            {hasInstructions ? (
              paymentInstructions.map(([label, value]) => (
                <View key={label} className="flex-row justify-between gap-3">
                  <Text variant="muted" className="text-xs">
                    {label}
                  </Text>
                  <Text className="text-xs" numberOfLines={2}>
                    {value}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="muted" className="text-xs">
                No payment instructions configured yet. Set them in your trainer profile.
              </Text>
            )}
          </View>
        </Section>

        <Section title="Invoices">
          {invoices.length === 0 ? (
            <Text variant="muted" className="text-sm">
              No invoices for this client.
            </Text>
          ) : (
            <View className="gap-3">
              {invoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  busy={busy}
                  onApprove={(paymentId) => decidePayment(paymentId, true)}
                  onReject={(paymentId) => decidePayment(paymentId, false)}
                  onForgive={forgiveInvoice}
                />
              ))}
            </View>
          )}
        </Section>

        <Section title="Danger zone">
          {/* Feature 18: soft deactivate/reactivate toggle — never a delete.
              The trash icon for permanent deletion lives in the Clients list. */}
          <Button
            variant={client.is_active ? 'destructive' : 'default'}
            disabled={busy}
            onPress={toggleActive}>
            <Text className="text-sm font-medium text-white">
              {client.is_active ? 'Deactivate client' : 'Reactivate client'}
            </Text>
          </Button>
          <Text variant="muted" className="text-xs">
            {client.is_active
              ? 'Soft-deactivates the client: they keep their data and OTP, cannot log in or receive sessions, and stay listed as inactive.'
              : 'Reactivating restores login with the same OTP and session assignment. All data is intact.'}
          </Text>
        </Section>
      </View>
    </Screen>
  );
}
