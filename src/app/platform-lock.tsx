import { useRouter } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';

import { Badge, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/confirm';
import { shortDate } from '@/lib/dates';
import {
  platformErrorMessage,
  platformStateLabel,
  submitPlatformPayment,
  type PlatformBilling,
} from '@/lib/platform';

const CHANNELS = ['Telebirr', 'CBE'];

function toneForState(state: PlatformBilling['state']) {
  switch (state) {
    case 'active':
    case 'trial':
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
      return 'danger' as const;
    default:
      return 'default' as const;
  }
}

export default function PlatformLockScreen() {
  const router = useRouter();
  const { platform, refreshPlatform, signOut } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [channel, setChannel] = React.useState(CHANNELS[0]);
  const [transactionRef, setTransactionRef] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const next = await refreshPlatform();
      if (next?.allowed) {
        router.replace('/');
        return;
      }
    } catch (e) {
      setError(platformErrorMessage(e, 'Could not refresh your subscription status.'));
    } finally {
      setRefreshing(false);
    }
  }, [refreshPlatform, router]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, 20_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const submit = async () => {
    if (!transactionRef.trim()) {
      setError('Enter the transaction ID you used for the payment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await submitPlatformPayment(channel, transactionRef.trim());
      setInfo(res.detail);
      setTransactionRef('');
      await refreshPlatform();
    } catch (e) {
      setError(platformErrorMessage(e, 'Could not submit your payment reference.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!platform) {
    return (
      <Screen>
        <LoadingView label="Checking your subscription…" />
      </Screen>
    );
  }

  const needsSetup = !platform.setup_fee_paid;
  const canSubmit = needsSetup || platform.can_submit_payment;

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <ScreenHeader
        title="Subscription required"
        subtitle="Your access is paused until the platform payment is approved."
      />

      <View className="gap-4">
        <Card className="gap-3 p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-sm font-semibold">Status</Text>
            <Badge tone={toneForState(platform.state)} label={platformStateLabel(platform.state)} />
          </View>

          {platform.free_trial_ends_at ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Free trial ends
              </Text>
              <Text className="text-sm font-medium">
                {shortDate(platform.free_trial_ends_at)}
              </Text>
            </View>
          ) : null}

          {platform.paid_until ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Paid until
              </Text>
              <Text className="text-sm font-medium">{shortDate(platform.paid_until)}</Text>
            </View>
          ) : null}

          {platform.days_remaining !== null ? (
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Days remaining
              </Text>
              <Text className="text-sm font-medium">{platform.days_remaining}</Text>
            </View>
          ) : null}
        </Card>

        {platform.notices.length > 0 ? (
          <Card className="gap-2 p-4">
            {platform.notices.map((notice) => (
              <View key={notice.id} className="gap-1">
                <Text className="text-sm font-semibold">{notice.title}</Text>
                <Text variant="muted" className="text-sm">
                  {notice.message}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {canSubmit ? (
          <Card className="gap-3 p-4">
            <Text className="text-sm font-semibold">
              {needsSetup ? 'Submit setup fee' : 'Submit quarterly payment'}
            </Text>
            <Text variant="muted" className="text-sm">
              {needsSetup
                ? `Setup fee: ${platform.setup_fee_etb} ETB. Send via Telebirr or CBE, then share the transaction ID.`
                : `Quarterly fee: ${platform.quarterly_fee_etb} ETB. Send via Telebirr or CBE, then share the transaction ID.`}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CHANNELS.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={channel === item ? 'default' : 'outline'}
                  onPress={() => setChannel(item)}>
                  <Text className="text-xs">{item}</Text>
                </Button>
              ))}
            </View>
            <Input
              placeholder="Transaction ID / Reference"
              autoCapitalize="none"
              value={transactionRef}
              onChangeText={setTransactionRef}
            />
            {info ? <Text className="text-xs text-emerald-600">{info}</Text> : null}
            {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
            <Button disabled={submitting} onPress={() => void submit()}>
              <Text className="text-sm font-semibold text-primary-foreground">
                {submitting ? 'Submitting…' : 'Submit payment reference'}
              </Text>
            </Button>
          </Card>
        ) : null}

        {error && !canSubmit ? <ErrorView error={error} onRetry={() => void refresh()} /> : null}

        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => void refresh()}>
            <Text className="text-sm font-semibold">Check status</Text>
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            onPress={() => {
              void (async () => {
                const ok = await confirmAction({
                  title: 'Sign out?',
                  message: 'You can sign back in once your payment is approved.',
                  confirmLabel: 'Sign out',
                });
                if (!ok) return;
                await signOut();
                router.replace('/auth/login');
              })();
            }}>
            <Text className="text-sm font-semibold text-destructive">Sign out</Text>
          </Button>
        </View>
      </View>
    </Screen>
  );
}
