import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { Badge, ErrorView, LoadingView, Screen } from '@/components/screen';
import { ClientBillingSection } from '@/components/billing/client-billing';
import { PaymentInstructionsSection } from '@/components/billing/payment-instructions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { usePlatformAccess } from '@/hooks/use-platform-access';
import { shortDate } from '@/lib/dates';
import { platformStateLabel, type PlatformBilling } from '@/lib/platform';

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

        <Card className="gap-3 p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-sm font-semibold">Subscription status</Text>
            <Badge tone={toneForState(billing.state)} label={platformStateLabel(billing.state)} />
          </View>
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
        </Card>

        {billing.notices.length > 0 ? (
          <Card className="gap-3 p-4">
            <Text className="text-sm font-semibold">Notices</Text>
            {billing.notices.map((notice) => (
              <View key={notice.id} className="gap-1">
                <Text className="text-sm font-semibold">{notice.title}</Text>
                <Text variant="muted" className="text-sm">
                  {notice.message}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {billing.pending_payment ? (
          <Card className="gap-2 p-4">
            <Text className="text-sm font-semibold">Pending review</Text>
            <Text variant="muted" className="text-sm">
              {billing.pending_payment.kind === 'setup' ? 'Setup fee' : 'Quarterly'} ·{' '}
              {billing.pending_payment.amount_etb} ETB via {billing.pending_payment.channel}
            </Text>
            <Text variant="muted" className="text-xs">
              Ref: {billing.pending_payment.transaction_ref}
            </Text>
          </Card>
        ) : null}

        {!billing.allowed ? (
          <Button variant="outline" size="lg" onPress={() => router.push('/platform-lock')}>
            <Text>Go to subscription</Text>
          </Button>
        ) : billing.can_submit_payment ? (
          <Button size="lg" onPress={() => router.push('/platform-lock')}>
            <Text>Submit quarterly payment</Text>
          </Button>
        ) : null}

        <ClientBillingSection />
      </View>
    </Screen>
  );
}
