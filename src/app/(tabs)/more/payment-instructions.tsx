import * as React from 'react';
import { Alert, View } from 'react-native';

import { ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Trainer } from '@/lib/types';

type Form = {
  telebirrNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  cashNote: string;
};

const EMPTY: Form = {
  telebirrNumber: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  cashNote: '',
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

export default function PaymentInstructionsScreen() {
  const { setTrainer } = useAuth();
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await api<Trainer>('auth/me/');
      setForm({
        telebirrNumber: me.telebirr_number,
        bankName: me.bank_name,
        bankAccountName: me.bank_account_name,
        bankAccountNumber: me.bank_account_number,
        cashNote: me.cash_note,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payment instructions.');
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
    setSaving(true);
    try {
      const updated = await api<Trainer>('auth/me/', {
        method: 'PATCH',
        body: {
          telebirr_number: form.telebirrNumber.trim(),
          bank_name: form.bankName.trim(),
          bank_account_name: form.bankAccountName.trim(),
          bank_account_number: form.bankAccountNumber.trim(),
          cash_note: form.cashNote.trim(),
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

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading instructions…" />
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
      <ScreenHeader
        title="Payment instructions"
        subtitle="How your clients pay you — reused when you create a client."
      />
      <View className="gap-6">
        <View className="gap-4 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Telebirr</Text>
          <Field
            label="Telebirr number"
            value={form.telebirrNumber}
            onChangeText={(v) => update({ telebirrNumber: v })}
            keyboardType="phone-pad"
            placeholder="09…"
          />
        </View>

        <View className="gap-4 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Bank transfer</Text>
          <Field
            label="Bank name"
            value={form.bankName}
            onChangeText={(v) => update({ bankName: v })}
          />
          <Field
            label="Account name"
            value={form.bankAccountName}
            onChangeText={(v) => update({ bankAccountName: v })}
          />
          <Field
            label="Account number"
            value={form.bankAccountNumber}
            onChangeText={(v) => update({ bankAccountNumber: v })}
            keyboardType="number-pad"
          />
        </View>

        <View className="gap-4 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold">Cash</Text>
          <View className="gap-1.5">
            <Text variant="muted" className="text-xs">
              Note for cash payments
            </Text>
            <Textarea
              value={form.cashNote}
              onChangeText={(v) => update({ cashNote: v })}
              placeholder="e.g. Pay at the gym front desk"
            />
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <Button disabled={saving} onPress={() => void save()}>
            <Text>{saving ? 'Saving…' : 'Save instructions'}</Text>
          </Button>
          {saved ? <Text variant="muted">Saved</Text> : null}
        </View>

        <Text variant="muted" className="text-xs">
          Clients see these details when they pay for a subscription.
        </Text>
      </View>
    </Screen>
  );
}
