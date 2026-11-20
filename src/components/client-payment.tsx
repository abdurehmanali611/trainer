import {
  BadgeDollarSignIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CreditCardIcon,
  GiftIcon,
  HourglassIcon,
  PencilIcon,
  PercentIcon,
  PlusIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  WalletIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { alpha, Chip, COLORS, IconBubble, Panel, Segmented } from '@/components/kit';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { DatePopoverField } from '@/components/ui/calendar';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { shortDate, todayISO } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import type { Client, SubscriptionPeriod } from '@/lib/types';

type InstructionOption = { id: number; label: string };

const PHASE_LABEL: Record<string, { label: string; color: string }> = {
  covered: { label: 'Paid up', color: COLORS.green },
  upcoming: { label: 'Not due yet', color: COLORS.sky },
  ask: { label: 'Payment requested', color: COLORS.amber },
  grace: { label: 'In grace period', color: COLORS.orange },
  blocked: { label: 'Blocked — unpaid', color: COLORS.rose },
  none: { label: '—', color: COLORS.muted },
};

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <Text className="text-sm font-bold" style={color ? { color } : undefined}>
        {value}
      </Text>
    </View>
  );
}

function PeriodCard({
  period,
  active,
  busy,
  onEdit,
  onDelete,
}: {
  period: SubscriptionPeriod;
  active: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = period.is_trial ? COLORS.violet : COLORS.amber;
  return (
    <Panel tint={color} className="gap-2 p-3.5">
      <View className="flex-row items-center gap-3">
        <IconBubble icon={period.is_trial ? GiftIcon : PercentIcon} color={color} size={40} />
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[15px] font-bold">{period.is_trial ? 'Free trial' : 'Discount'}</Text>
            <Chip label={active ? 'Running now' : 'Scheduled'} color={active ? COLORS.green : COLORS.sky} />
          </View>
          <Text variant="muted" className="text-xs">
            {shortDate(period.start_date)} → {shortDate(period.end_date)}
            {period.is_trial ? '' : ` · pays ${formatMoney(period.amount)}`}
          </Text>
        </View>
        <Pressable
          disabled={busy}
          onPress={onEdit}
          hitSlop={8}
          accessibilityLabel="Edit"
          className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
          style={{ backgroundColor: alpha(COLORS.sky, 0.14) }}>
          <Icon as={PencilIcon} size={16} color={COLORS.sky} />
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={onDelete}
          hitSlop={8}
          accessibilityLabel="Delete"
          className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
          style={{ backgroundColor: alpha(COLORS.rose, 0.14) }}>
          <Icon as={Trash2Icon} size={16} color={COLORS.rose} />
        </Pressable>
      </View>
    </Panel>
  );
}

/**
 * The client's payment picture, in one place:
 *   - free trial  -> "The client is in free trial" + the editable trial timeline
 *   - discount    -> "The client is in discount"  + the editable discount timeline
 *   - otherwise   -> the payment-instruction timeline (editable setup, never deleted)
 * Ended trials/discounts disappear from here (the records are kept server-side).
 */
export function ClientPaymentSection({
  client,
  periods,
  onChanged,
}: {
  client: Client;
  periods: SubscriptionPeriod[];
  onChanged: () => void | Promise<void>;
}) {
  const today = todayISO();
  const kind = client.status_kind ?? 'paid';
  const timeline = client.payment_timeline;
  const pricedPeriods = periods.filter((p) => p.is_trial || Number(p.amount) > 0);
  const active =
    pricedPeriods
      .filter((p) => p.start_date <= today && today <= p.end_date)
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null;
  const upcoming = pricedPeriods
    .filter((p) => p.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const [busy, setBusy] = React.useState(false);

  // ---- trial / discount form -------------------------------------------
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubscriptionPeriod | null>(null);
  const [formType, setFormType] = React.useState<'trial' | 'discount'>('trial');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [amount, setAmount] = React.useState('');

  function openForm(type: 'trial' | 'discount', period?: SubscriptionPeriod) {
    setEditing(period ?? null);
    setFormType(period ? (period.is_trial ? 'trial' : 'discount') : type);
    setStart(period?.start_date ?? today);
    setEnd(period?.end_date ?? '');
    setAmount(period && !period.is_trial ? String(Number(period.amount)) : '');
    setFormOpen(true);
  }

  async function savePeriod() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      Alert.alert('Dates required', 'Pick a start and an end date.');
      return;
    }
    if (end < start) {
      Alert.alert('Invalid dates', 'The end date must be on or after the start date.');
      return;
    }
    const isTrial = formType === 'trial';
    const value = Number(amount.trim());
    if (!isTrial && (!amount.trim() || !Number.isFinite(value) || value <= 0)) {
      Alert.alert('Discount amount', 'Enter the reduced amount this client will pay (more than 0).');
      return;
    }
    setBusy(true);
    try {
      const body = {
        start_date: start,
        end_date: end,
        is_trial: isTrial,
        amount: isTrial ? '0' : amount.trim(),
      };
      if (editing) await api(`periods/${editing.id}/`, { method: 'PATCH', body });
      else await api('periods/', { method: 'POST', body: { client_id: client.id, ...body } });
      setFormOpen(false);
      await onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function deletePeriod(period: SubscriptionPeriod) {
    const what = period.is_trial ? 'free trial' : 'discount';
    Alert.alert(
      `Delete ${what}?`,
      `${client.name} goes back to paying through their payment instruction right away.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api(`periods/${period.id}/`, { method: 'DELETE' });
              await onChanged();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Something went wrong.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  // ---- payment setup (instruction / illustration) ----------------------
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [instructions, setInstructions] = React.useState<InstructionOption[]>([]);
  const [illustration, setIllustration] = React.useState(false);
  const [instructionId, setInstructionId] = React.useState('');

  function openSetup() {
    setIllustration(kind === 'illustration');
    setInstructionId(client.payment_instruction ? String(client.payment_instruction) : '');
    setSetupOpen(true);
    api<InstructionOption[] | { results: InstructionOption[] }>('payment-instructions/')
      .then((res) => setInstructions(Array.isArray(res) ? res : res.results))
      .catch(() => setInstructions([]));
  }

  async function saveSetup() {
    if (!illustration && !instructionId) {
      Alert.alert(
        'Payment instruction required',
        'Choose a payment instruction, or mark the client as an illustration client.'
      );
      return;
    }
    setBusy(true);
    try {
      await api(`clients/${client.id}/payment-setup/`, {
        method: 'PATCH',
        body: {
          illustration,
          payment_instruction: illustration ? null : Number(instructionId),
        },
      });
      setSetupOpen(false);
      await onChanged();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  // ---- render -----------------------------------------------------------
  const phase = PHASE_LABEL[timeline?.phase ?? 'none'] ?? PHASE_LABEL.none;
  const inst = timeline?.instruction ?? null;
  const showInstructionTimeline = kind === 'paid' || kind === 'illustration';
  const prepaid = inst?.is_prepayment ?? true;

  return (
    <Section title="Payment" icon={CreditCardIcon} color={COLORS.green}>
      {/* What the client is right now */}
      {kind === 'trial' || kind === 'discount' ? (
        <View className="gap-3">
          <Panel tint={kind === 'trial' ? COLORS.violet : COLORS.amber} className="flex-row items-center gap-3 p-3.5">
            <IconBubble
              icon={kind === 'trial' ? SparklesIcon : BadgeDollarSignIcon}
              color={kind === 'trial' ? COLORS.violet : COLORS.amber}
              size={42}
            />
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-black">
                {kind === 'trial' ? 'The client is in free trial' : 'The client is in discount'}
              </Text>
              <Text variant="muted" className="text-xs">
                {kind === 'trial'
                  ? 'Nothing is paid during the trial.'
                  : prepaid
                    ? 'The discounted price counts as already paid.'
                    : 'The client pays the reduced amount below, once, at the end.'}
                {timeline?.days_left != null ? ` ${timeline.days_left} day${timeline.days_left === 1 ? '' : 's'} left.` : ''}
              </Text>
            </View>
          </Panel>
          {active ? (
            <PeriodCard
              period={active}
              active
              busy={busy}
              onEdit={() => openForm(active.is_trial ? 'trial' : 'discount', active)}
              onDelete={() => deletePeriod(active)}
            />
          ) : null}
          {/* When the next / first payment is requested, by the instruction's ask + grace rules */}
          {timeline?.due_on ? (
            <Panel tint={phase.color} className="gap-2 p-3.5">
              <View className="flex-row flex-wrap items-center gap-2">
                <Chip
                  label={timeline.phase === 'none' || timeline.phase === 'upcoming' ? 'Not asked yet' : phase.label}
                  color={phase.color}
                />
                {timeline.awaiting_approval ? <Chip label="Awaiting your approval" color={COLORS.cyan} /> : null}
              </View>
              <Text variant="muted" className="text-xs">
                {kind === 'trial'
                  ? 'Prepaid: the first paid period after the trial is requested near the end of the trial.'
                  : prepaid
                    ? 'The next full-price period is requested near the end of the discount.'
                    : 'The discounted price is requested near the end of the discount.'}
              </Text>
              {timeline.ask_opens_on ? (
                <Row label="Client is asked from" value={shortDate(timeline.ask_opens_on)} color={COLORS.amber} />
              ) : null}
              <Row label="Deadline (0 days left)" value={shortDate(timeline.due_on)} />
              {timeline.blocked_from ? (
                <Row label="Blocked from" value={shortDate(timeline.blocked_from)} color={COLORS.rose} />
              ) : null}
            </Panel>
          ) : null}
        </View>
      ) : null}

      {showInstructionTimeline ? (
        <View className="gap-3">
          <Panel tint={kind === 'illustration' ? COLORS.pink : phase.color} className="gap-3 p-3.5">
            {kind === 'illustration' ? (
              <View className="flex-row items-center gap-3">
                <IconBubble icon={ShieldAlertIcon} color={COLORS.pink} size={42} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-black">Illustration client</Text>
                  <Text variant="muted" className="text-xs">
                    This client never pays and is never asked to. Switch them to a payment instruction to start
                    billing.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-3">
                  <IconBubble icon={WalletIcon} color={phase.color} size={42} />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-[15px] font-black" numberOfLines={1}>
                      {inst?.label ?? 'Payment instruction'}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Chip label={phase.label} color={phase.color} />
                      {timeline?.awaiting_approval ? <Chip label="Awaiting your approval" color={COLORS.cyan} /> : null}
                    </View>
                  </View>
                </View>
                <View className="gap-2 pt-1">
                  {inst ? (
                    <>
                      <Row label="Billing cycle" value={inst.cycle_label} />
                      <Row
                        label="Amount"
                        value={inst.amount != null ? formatMoney(inst.amount) : 'Not set'}
                      />
                      <Row label="Money is requested" value={inst.is_prepayment ? 'At the start' : 'At the end'} />
                    </>
                  ) : null}
                  {timeline?.cycle_start ? (
                    <Row
                      label="Current cycle"
                      value={`${shortDate(timeline.cycle_start)} → ${shortDate(timeline.cycle_end)}`}
                    />
                  ) : null}
                  {timeline?.ask_opens_on ? (
                    <Row label="Client is asked from" value={shortDate(timeline.ask_opens_on)} color={COLORS.amber} />
                  ) : null}
                  {timeline?.due_on ? (
                    <Row label="Deadline (0 days left)" value={shortDate(timeline.due_on)} />
                  ) : null}
                  {timeline?.blocked_from ? (
                    <Row
                      label="Blocked from"
                      value={shortDate(timeline.blocked_from)}
                      color={COLORS.rose}
                    />
                  ) : null}
                  {timeline?.phase === 'covered' && timeline.next_due_on ? (
                    <Row label="Next payment due" value={shortDate(timeline.next_due_on)} />
                  ) : null}
                </View>
              </>
            )}
            <Button variant="outline" disabled={busy} onPress={openSetup} className="self-start rounded-xl">
              <Icon as={PencilIcon} size={15} color={COLORS.sky} />
              <Text>Edit payment setup</Text>
            </Button>
          </Panel>
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={CalendarClockIcon} size={14} color={COLORS.sky} />
            <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.sky }}>
              Scheduled
            </Text>
          </View>
          {upcoming.map((p) => (
            <PeriodCard
              key={p.id}
              period={p}
              active={false}
              busy={busy}
              onEdit={() => openForm(p.is_trial ? 'trial' : 'discount', p)}
              onDelete={() => deletePeriod(p)}
            />
          ))}
        </View>
      ) : null}

      {kind !== 'illustration' ? (
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            disabled={busy}
            onPress={() => openForm('trial')}
            accessibilityRole="button"
            className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80"
            style={{ backgroundColor: alpha(COLORS.violet, 0.16), borderWidth: 1, borderColor: alpha(COLORS.violet, 0.4) }}>
            <Icon as={GiftIcon} size={16} color={COLORS.violet} />
            <Text className="text-sm font-black" style={{ color: COLORS.violet }}>
              Free trial
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => openForm('discount')}
            accessibilityRole="button"
            className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80"
            style={{ backgroundColor: alpha(COLORS.amber, 0.16), borderWidth: 1, borderColor: alpha(COLORS.amber, 0.4) }}>
            <Icon as={PlusIcon} size={16} color={COLORS.amber} />
            <Text className="text-sm font-black" style={{ color: COLORS.amber }}>
              Discount
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Add / edit a free trial or discount */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit' : 'Assign'} {formType === 'trial' ? 'free trial' : 'discount'}
            </DialogTitle>
            <DialogDescription>
              {formType === 'trial'
                ? 'No payment is asked while it runs. When it ends the payment instruction takes over.'
                : 'The client pays this reduced amount for the period, then returns to the normal price.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody contentContainerClassName="gap-4">
            {!editing ? (
              <Segmented<'trial' | 'discount'>
                value={formType}
                onChange={setFormType}
                options={[
                  { key: 'trial', label: 'Free trial', icon: GiftIcon },
                  { key: 'discount', label: 'Discount', icon: PercentIcon },
                ]}
              />
            ) : null}
            <DialogSection icon={CalendarClockIcon} label="Timeline" className="gap-3">
              <DatePopoverField label="Start date" value={start} onChange={setStart} placeholder="Pick a date" />
              <DatePopoverField
                label="End date"
                minDate={start || undefined}
                value={end}
                onChange={setEnd}
                placeholder="Pick a date"
              />
            </DialogSection>
            {formType === 'discount' ? (
              <DialogSection icon={BadgeDollarSignIcon} label="Reduced price" className="gap-2">
                <Input
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount the client pays"
                />
                <Text variant="muted" className="text-xs">
                  This is exactly what the client sees in the payment portal.
                </Text>
              </DialogSection>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onPress={() => setFormOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button disabled={busy} onPress={() => void savePeriod()}>
              <Text>{busy ? 'Saving…' : editing ? 'Save' : 'Assign'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit how the client pays */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment setup</DialogTitle>
            <DialogDescription>
              Switch this client to another payment instruction, or make them an illustration client.
            </DialogDescription>
          </DialogHeader>
          <DialogBody contentContainerClassName="gap-4">
            <DialogSection
              icon={HourglassIcon}
              label="Illustration"
              className={illustration ? 'border-primary/40 bg-primary/5' : undefined}>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-medium">Not payable</Text>
                  <Text variant="muted" className="text-xs">
                    On = this client never pays and is never asked to.
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
                    options={instructions.map((item) => ({ value: String(item.id), label: item.label }))}
                    placeholder="Pick a payment instruction"
                    searchPlaceholder="Search instructions…"
                    align="left"
                    emptyText="No payment instructions yet — create one in Billing."
                    className="w-full"
                  />
                </View>
              ) : null}
            </DialogSection>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onPress={() => setSetupOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button disabled={busy} onPress={() => void saveSetup()}>
              <Icon as={CircleCheckIcon} size={16} color="#04110A" />
              <Text>{busy ? 'Saving…' : 'Save'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
