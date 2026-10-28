import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import {
  BanknoteIcon,
  LandmarkIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
} from 'lucide-react-native';

import { Badge, EmptyView } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { DateField } from '@/components/ui/calendar';
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
import { PhoneNumberInput } from '@/components/phone-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { ETHIOPIAN_BANKS } from '@/lib/ethiopian-banks';
import { shortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export type Instruction = {
  id: number;
  label: string;
  channel: 'telebirr' | 'bank' | 'cash';
  telebirr_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  amount: string | null;
  is_prepayment: boolean;
  billing_cycle: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
  cycle_from: string | null;
  cycle_to: string | null;
  cycle_label: string;
  start_ask_days: number;
  grace_days: number;
  is_active: boolean;
  assigned_clients: { id: number; name: string }[];
  created_at: string;
};

const CHANNEL_OPTIONS = [
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
];

const CYCLE_OPTIONS: { value: Instruction['billing_cycle']; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half a year' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Customize' },
];

type Draft = {
  id: number | null;
  label: string;
  channel: 'telebirr' | 'bank' | 'cash';
  telebirr: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  amount: string;
  isPrepayment: boolean;
  cycle: Instruction['billing_cycle'];
  cycleFrom: string;
  cycleTo: string;
  startAsk: string;
  grace: string;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  label: '',
  channel: 'telebirr',
  telebirr: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  amount: '',
  isPrepayment: true,
  cycle: 'monthly',
  cycleFrom: '',
  cycleTo: '',
  startAsk: '',
  grace: '',
};

function draftFrom(instruction: Instruction): Draft {
  return {
    id: instruction.id,
    label: instruction.label,
    channel: instruction.channel,
    telebirr: instruction.telebirr_number,
    bankName: instruction.bank_name,
    accountName: instruction.bank_account_name,
    accountNumber: instruction.bank_account_number,
    amount: instruction.amount ?? '',
    isPrepayment: instruction.is_prepayment,
    cycle: instruction.billing_cycle,
    cycleFrom: instruction.cycle_from ?? '',
    cycleTo: instruction.cycle_to ?? '',
    startAsk: instruction.start_ask_days ? String(instruction.start_ask_days) : '',
    grace: instruction.grace_days ? String(instruction.grace_days) : '',
  };
}

/** e.g. "7 day subscription" for a custom 20/07 → 27/07 range. */
function customCycleLabel(from: string, to: string): string | null {
  if (!from || !to) return null;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days <= 0) return null;
  return `${days} day subscription`;
}

function ChannelIcon({ channel }: { channel: Instruction['channel'] }) {
  const icon =
    channel === 'telebirr' ? SmartphoneIcon : channel === 'bank' ? LandmarkIcon : BanknoteIcon;
  return (
    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/25">
      <Icon as={icon} size={17} className="text-primary" />
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="muted" className="text-xs font-medium">
      {children}
    </Text>
  );
}

function CycleRadio({
  option,
  selected,
  onSelect,
}: {
  option: { value: Instruction['billing_cycle']; label: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      className={cn(
        'flex-row items-center gap-2.5 rounded-xl border px-3 py-2.5 active:opacity-75',
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      )}>
      <RadioGroupItem value={option.value} />
      <Text className={cn('text-sm', selected && 'font-semibold text-primary')}>
        {option.label}
      </Text>
    </Pressable>
  );
}

export function PaymentInstructionsSection() {
  const [items, setItems] = React.useState<Instruction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await api<Instruction[] | { results: Instruction[] }>('payment-instructions/');
      setItems(Array.isArray(res) ? res : res.results);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  }

  function openEdit(instruction: Instruction) {
    setDraft(draftFrom(instruction));
    setOpen(true);
  }

  async function save() {
    if (!draft.label.trim()) {
      Alert.alert('Label required', 'Give this instruction a short name (e.g. "Telebirr main").');
      return;
    }
    if (draft.channel === 'telebirr' && !draft.telebirr.trim()) {
      Alert.alert('Telebirr number required', 'Enter the Telebirr number clients should pay to.');
      return;
    }
    if (draft.channel === 'bank' && !draft.bankName.trim()) {
      Alert.alert('Bank required', 'Pick the bank for this transfer instruction.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        label: draft.label.trim(),
        channel: draft.channel,
        telebirr_number: draft.channel === 'telebirr' ? draft.telebirr.trim() : '',
        bank_name: draft.channel === 'bank' ? draft.bankName.trim() : '',
        bank_account_name: draft.channel === 'bank' ? draft.accountName.trim() : '',
        bank_account_number: draft.channel === 'bank' ? draft.accountNumber.trim() : '',
        amount: draft.amount.trim() ? draft.amount.trim() : null,
        is_prepayment: draft.isPrepayment,
        billing_cycle: draft.cycle,
        cycle_from: draft.cycle === 'custom' ? draft.cycleFrom : null,
        cycle_to: draft.cycle === 'custom' ? draft.cycleTo : null,
        start_ask_days: Math.max(0, parseInt(draft.startAsk, 10) || 0),
        grace_days: Math.max(0, parseInt(draft.grace, 10) || 0),
      };
      if (draft.id) {
        await api(`payment-instructions/${draft.id}/`, { method: 'PATCH', body });
      } else {
        await api('payment-instructions/', { method: 'POST', body });
      }
      setOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    Alert.alert('Delete instruction?', 'Clients assigned to it will keep paying your other methods.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`payment-instructions/${id}/`, { method: 'DELETE' });
            setItems((list) => list.filter((item) => item.id !== id));
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  const customLabel =
    draft.cycle === 'custom' ? customCycleLabel(draft.cycleFrom, draft.cycleTo) : null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text className="text-sm font-semibold">My payment instructions</Text>
          <Text variant="muted" className="text-xs">
            Reusable methods you attach to clients when you create them.
          </Text>
        </View>
        <Button size="sm" onPress={openCreate}>
          <Icon as={PlusIcon} size={15} />
          <Text>New</Text>
        </Button>
      </View>

      {loading ? (
        <Text variant="muted" className="text-xs">
          Loading instructions…
        </Text>
      ) : items.length === 0 ? (
        <EmptyView
          title="No payment instructions yet"
          subtitle="Create one so every new client knows exactly how to pay you."
          action={
            <Button size="sm" onPress={openCreate}>
              <Text>Create instruction</Text>
            </Button>
          }
        />
      ) : (
        items.map((instruction) => (
          <Pressable
            key={instruction.id}
            onPress={() => openEdit(instruction)}
            className="gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm shadow-black/[0.05] active:bg-accent/40 dark:shadow-black/30">
            <View className="flex-row items-center gap-3">
              <ChannelIcon channel={instruction.channel} />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-medium" numberOfLines={1}>
                  {instruction.label}
                </Text>
                <Text variant="muted" className="text-xs" numberOfLines={1}>
                  {instruction.channel === 'telebirr'
                    ? `Telebirr ${instruction.telebirr_number || '—'}`
                    : instruction.channel === 'bank'
                      ? `${instruction.bank_name || 'Bank'} · ${instruction.bank_account_number || '—'}`
                      : 'Cash collection'}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Badge label={instruction.cycle_label} tone="info" />
                <Badge
                  label={instruction.is_prepayment ? 'Pre-payment' : 'Paid at end'}
                  tone={instruction.is_prepayment ? 'success' : 'warning'}
                />
              </View>
            </View>

            <View className="flex-row flex-wrap gap-1.5">
              {instruction.amount ? (
                <Badge label={`ETB ${instruction.amount}`} tone="success" />
              ) : null}
              {instruction.start_ask_days > 0 ? (
                <Badge label={`Ask ${instruction.start_ask_days}d before end`} tone="warning" />
              ) : null}
              {instruction.grace_days > 0 ? (
                <Badge label={`${instruction.grace_days}d grace`} tone="info" />
              ) : null}
            </View>

            <View className="gap-1.5">
              <Text variant="muted" className="text-xs font-semibold uppercase tracking-wide">
                Assigned to
              </Text>
              {instruction.assigned_clients.length === 0 ? (
                <Text variant="muted" className="text-xs">
                  Not attached to any client yet — pick it when you create one.
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-1.5">
                  {instruction.assigned_clients.map((client) => (
                    <View
                      key={client.id}
                      className="rounded-full bg-secondary px-2.5 py-1">
                      <Text className="text-xs font-medium text-secondary-foreground">
                        {client.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View className="flex-row items-center justify-between">
              <Text variant="muted" className="text-[11px]">
                Created {shortDate(instruction.created_at)}
              </Text>
              <Pressable
                onPress={() => remove(instruction.id)}
                hitSlop={8}
                className="flex-row items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 active:opacity-70">
                <Trash2Icon size={12} color="#E11D48" />
                <Text className="text-[11px] font-semibold text-rose-600">Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit instruction' : 'New payment instruction'}</DialogTitle>
            <DialogDescription>
              How clients pay you — attach it to a client when you create them.
            </DialogDescription>
          </DialogHeader>

          <View className="gap-4">
            <View className="gap-2 rounded-2xl border border-border bg-card p-3.5">
              <FieldLabel>Details</FieldLabel>
              <Input
                placeholder="Label (e.g. Telebirr main)"
                value={draft.label}
                onChangeText={(label) => setDraft((d) => ({ ...d, label }))}
              />
              <Combobox
                value={draft.channel}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, channel: value as Draft['channel'] }))
                }
                options={CHANNEL_OPTIONS}
                placeholder="Payment channel"
                searchPlaceholder="Search channel…"
                align="left"
                className="w-full"
              />
            </View>

            {draft.channel === 'telebirr' ? (
              <View className="gap-2 rounded-2xl border border-primary/30 bg-primary/[0.06] p-3.5">
                <FieldLabel>Telebirr number</FieldLabel>
                <PhoneNumberInput
                  value={draft.telebirr}
                  onChange={(telebirr) => setDraft((d) => ({ ...d, telebirr }))}
                />
              </View>
            ) : null}

            {draft.channel === 'bank' ? (
              <View className="gap-2 rounded-2xl border border-border bg-card p-3.5">
                <FieldLabel>Bank transfer</FieldLabel>
                <Combobox
                  value={draft.bankName}
                  onValueChange={(bankName) => setDraft((d) => ({ ...d, bankName }))}
                  options={ETHIOPIAN_BANKS.map((bank) => ({ value: bank, label: bank }))}
                  placeholder="Pick a bank"
                  searchPlaceholder="Search Ethiopian banks…"
                  align="left"
                  className="w-full"
                />
                <Input
                  placeholder="Account holder name"
                  value={draft.accountName}
                  onChangeText={(accountName) => setDraft((d) => ({ ...d, accountName }))}
                />
                <Input
                  placeholder="Account number"
                  value={draft.accountNumber}
                  onChangeText={(accountNumber) => setDraft((d) => ({ ...d, accountNumber }))}
                  autoCapitalize="none"
                />
              </View>
            ) : null}

            <View className="gap-2.5 rounded-2xl border border-border bg-card p-3.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 gap-0.5 pr-3">
                  <Text className="text-sm font-semibold">Pre-payment</Text>
                  <Text variant="muted" className="text-xs">
                    {draft.isPrepayment
                      ? 'Requested at the start of the subscription.'
                      : 'Requested at the end of the subscription.'}
                  </Text>
                </View>
                <Switch
                  checked={draft.isPrepayment}
                  onCheckedChange={(isPrepayment) => setDraft((d) => ({ ...d, isPrepayment }))}
                />
              </View>

              <Separator />

              <FieldLabel>Billing cycle</FieldLabel>
              <View className="gap-2">
                <RadioGroup
                  value={draft.cycle}
                  onValueChange={(value) =>
                    setDraft((d) => ({ ...d, cycle: value as Draft['cycle'] }))
                  }>
                  <View className="flex-row flex-wrap gap-2">
                    {CYCLE_OPTIONS.map((option) => (
                      <View key={option.value} className="w-[47%]">
                        <CycleRadio
                          option={option}
                          selected={draft.cycle === option.value}
                          onSelect={() => setDraft((d) => ({ ...d, cycle: option.value }))}
                        />
                      </View>
                    ))}
                  </View>
                </RadioGroup>
              </View>

              {draft.cycle === 'custom' ? (
                <View className="gap-2">
                  <View className="flex-row gap-3">
                    <DateField
                      label="From"
                      value={draft.cycleFrom}
                      onChange={(cycleFrom) => setDraft((d) => ({ ...d, cycleFrom }))}
                      className="flex-1"
                    />
                    <DateField
                      label="To"
                      value={draft.cycleTo}
                      onChange={(cycleTo) => setDraft((d) => ({ ...d, cycleTo }))}
                      className="flex-1"
                    />
                  </View>
                  {customLabel ? (
                    <View className="self-start rounded-full bg-primary/12 px-3 py-1">
                      <Text className="text-xs font-semibold text-primary">{customLabel}</Text>
                    </View>
                  ) : (
                    <Text variant="muted" className="text-xs">
                      Pick both dates to calculate the subscription type.
                    </Text>
                  )}
                </View>
              ) : null}

              <Separator />

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <FieldLabel>Start ask (days)</FieldLabel>
                  <Input
                    placeholder="e.g. 5"
                    keyboardType="number-pad"
                    value={draft.startAsk}
                    onChangeText={(startAsk) => setDraft((d) => ({ ...d, startAsk }))}
                  />
                </View>
                <View className="flex-1 gap-1.5">
                  <FieldLabel>Grace (days)</FieldLabel>
                  <Input
                    placeholder="e.g. 2"
                    keyboardType="number-pad"
                    value={draft.grace}
                    onChangeText={(grace) => setDraft((d) => ({ ...d, grace }))}
                  />
                </View>
              </View>
              <Text variant="muted" className="text-[11px]">
                Start ask: the client is asked to pay & send the transaction id this many days
                before the period ends. Grace: the app stays open this many days after the final
                day, then login is blocked.
              </Text>
            </View>

            <View className="gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.08] p-3.5">
              <FieldLabel>Amount</FieldLabel>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  ETB
                </Text>
                <Input
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={draft.amount}
                  onChangeText={(amount) => setDraft((d) => ({ ...d, amount }))}
                  className="flex-1"
                />
              </View>
              <Text variant="muted" className="text-[11px]">
                Leave empty if the amount depends on the package the client picks.
              </Text>
            </View>
          </View>

          <DialogFooter>
            <Button variant="outline" onPress={() => setOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button disabled={saving} onPress={() => void save()}>
              <Text>{saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
