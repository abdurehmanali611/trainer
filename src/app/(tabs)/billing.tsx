import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { Badge, ErrorView, LoadingView, Screen } from '@/components/screen';
import { Section } from '@/components/section';
import { ClientBillingSection } from '@/components/billing/client-billing';
import { PaymentInstructionsSection } from '@/components/billing/payment-instructions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { usePlatformAccess } from '@/hooks/use-platform-access';
import { shortDate } from '@/lib/dates';
import {
  platformStateLabel,
  submitPlatformPayment,
  type PlatformBilling,
} from '@/lib/platform';

function toneForState(state: PlatformBilling['state']) {
  switch (state) {
    case 'active':
    case 'trial':
    case 'exempt':
      return 'success' as const;
    case 'warning':
    case 'trial_ending':
      return 'warning' as const;
    case 'expired':
    case 'setup_required':
    case 'setup_pending':
    case 'on_hold':
    case 'suspended':
    case 'banned':
    case 'deleted':
      return 'danger' as const;
    default:
      return 'default' as const;
  }
}

export default function BillingScreen() {
  const router = useRouter();
  const { billing, loading, error, refresh } = usePlatformAccess();
  const [refreshing, setRefreshing] = React.useState(false);
  // Feature 17: the setup-fee payment fields live inline in the Billing
  // section (same channel + transaction-id contract as the client portal).
  const [channel, setChannel] = React.useState<'Telebirr' | 'CBE'>('Telebirr');
  const [transactionRef, setTransactionRef] = React.useState('');
  const [paying, setPaying] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);
  const [payInfo, setPayInfo] = React.useState<string | null>(null);

  async function submitPlatformFee() {
    if (!transactionRef.trim()) {
      setPayError('Enter the transaction ID you used for the payment.');
      return;
    }
    setPaying(true);
    setPayError(null);
    setPayInfo(null);
    try {
      const res = await submitPlatformPayment(channel, transactionRef.trim());
      setPayInfo(res.detail);
      setTransactionRef('');
      await refresh();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Could not submit your payment reference.');
    } finally {
      setPaying(false);
    }
  }

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  if (loading && !billing) {
    return (
      <Screen>
        <LoadingView label="Loading subscription…" />
      </Screen>
    );
  }

  if (error && !billing) {
    return (
      <Screen>
        <ErrorView error={error} onRetry={() => void refresh()} />
      </Screen>
    );
  }

  if (!billing) {
    return (
      <Screen>
        <ErrorView error="Could not load your subscription." onRetry={() => void refresh()} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View className="mt-5 gap-4">
        <PaymentInstructionsSection />

        <Section
          title="Subscription status"
          action={<Badge tone={toneForState(billing.state)} label={platformStateLabel(billing.state)} />}>
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="muted" className="text-sm">
              Setup fee
            </Text>
            <Text className="text-sm font-medium">
              {billing.setup_fee_etb} ETB · {billing.setup_fee_paid ? 'Paid' : 'Unpaid'}
            </Text>
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <Text variant="muted" className="text-sm">
              Quarterly fee
            </Text>
            <Text className="text-sm font-medium">{billing.quarterly_fee_etb} ETB</Text>
          </View>
          {billing.free_trial_ends_at ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Free trial ends
              </Text>
              <Text className="text-sm font-medium">{shortDate(billing.free_trial_ends_at)}</Text>
            </View>
          ) : null}
          {billing.paid_until ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Paid until
              </Text>
              <Text className="text-sm font-medium">{shortDate(billing.paid_until)}</Text>
            </View>
          ) : null}
          {billing.days_remaining !== null ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Days remaining
              </Text>
              <Text className="text-sm font-medium">{billing.days_remaining}</Text>
            </View>
          ) : null}
          {billing.window_opens_on ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Renewal window opens
              </Text>
              <Text className="text-sm font-medium">{shortDate(billing.window_opens_on)}</Text>
            </View>
          ) : null}
        </Section>

        {billing.notices.length > 0 ? (
          <Section title="Notices">
            {billing.notices.map((notice) => (
              <View key={notice.id} className="gap-1 rounded-xl border border-border bg-muted/70 p-3">
                <Text className="text-sm font-semibold">{notice.title}</Text>
                <Text variant="muted" className="text-sm">
                  {notice.message}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {billing.pending_payment ? (
          <Section title="Pending review">
            <Text variant="muted" className="text-sm">
              {billing.pending_payment.kind === 'setup' ? 'Setup fee' : 'Quarterly'} ·{' '}
              {billing.pending_payment.amount_etb} ETB via {billing.pending_payment.channel}
            </Text>
            <Text variant="muted" className="text-xs">
              Ref: {billing.pending_payment.transaction_ref}
            </Text>
          </Section>
        ) : null}

        {/* Feature 17: the setup/quarterly payment fields live in the Billing
            section (channel + transaction id) — not the header. Exempt
            accounts never see a payment form at all (feature 32).
            Feature 16: quarterly fields only appear once the 7-day window opens. */}
        {!billing.is_illustration &&
        !billing.pending_payment &&
        (!billing.setup_fee_paid || billing.can_submit_payment) ? (
          <Section
            title={!billing.setup_fee_paid ? 'Pay the setup fee' : 'Pay the quarterly fee'}
            subtitle="Send the fee through your payment channel, then submit the transaction ID below. Apex reviews it before access resumes.">
            <View className="flex-row gap-2">
              {(['Telebirr', 'CBE'] as const).map((ch) => (
                <Button
                  key={ch}
                  variant={channel === ch ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => setChannel(ch)}>
                  <Text className="text-sm">{ch}</Text>
                </Button>
              ))}
            </View>
            <Input
              placeholder="Transaction ID"
              autoCapitalize="characters"
              value={transactionRef}
              onChangeText={setTransactionRef}
            />
            {payError ? (
              <Text className="text-xs text-destructive">{payError}</Text>
            ) : null}
            {payInfo ? (
              <Text className="text-xs text-success">{payInfo}</Text>
            ) : null}
            <Button disabled={paying} onPress={() => void submitPlatformFee()}>
              <Text>{paying ? 'Submitting…' : 'Submit payment reference'}</Text>
            </Button>
          </Section>
        ) : null}

        {/* Feature 32: exempt trainers get no payment prompts whatsoever. */}
        {billing.is_illustration ? (
          <Section title="Exempt account">
            <Text variant="muted" className="text-xs">
              This account is illustrative — it is never billed and never sits
              in a payment queue.
            </Text>
          </Section>
        ) : null}

        {!billing.allowed ? (
          <Button variant="outline" size="lg" onPress={() => router.push('/platform-lock')}>
            <Text>Go to subscription</Text>
          </Button>
        ) : !billing.is_illustration && billing.can_submit_payment ? (
          <Button size="lg" onPress={() => router.push('/platform-lock')}>
            <Text>Submit quarterly payment</Text>
          </Button>
        ) : null}

        <ClientBillingSection />
      </View>
    </Screen>
  );
}
