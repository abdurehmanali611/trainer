import * as React from 'react';
import { Alert, View } from 'react-native';

import { Badge } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  billingErrorMessage,
  decideClientPayment,
  fetchPendingPayments,
} from '@/lib/client-billing';
import { shortDate } from '@/lib/dates';
import { formatMoney, labelize } from '@/lib/format';
import type { Payment } from '@/lib/types';

/**
 * Feature 14: the trainer's client-payment area shows ONLY incoming
 * approval requests — pending `Payment` rows submitted through the client's
 * payment portal (feature 12), each with Approve / Reject.
 *
 * Reject pops an alert requiring a reason: submission is blocked while the
 * reason is empty, and the reason is stored on the payment
 * (`decision_note`) and delivered to the client as the rejection
 * notification. Approve marks the invoice paid and notifies the client that
 * access is unlocked.
 */
export function ClientBillingSection() {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Reject dialog — reason is required.
  const [rejecting, setRejecting] = React.useState<Payment | null>(null);
  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const rows = await fetchPendingPayments();
      setPayments(rows);
      setError(null);
    } catch (e) {
      setError(billingErrorMessage(e, 'Could not load payment requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function closeReject() {
    setRejecting(null);
    setReason('');
    setReasonError(null);
  }

  function approve(payment: Payment) {
    Alert.alert(
      'Approve payment',
      `Approve ${payment.transaction_id} from ${payment.client_name}? Their invoice is marked paid and they are notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            setBusy(true);
            decideClientPayment(payment, 'approve')
              .then(() => load())
              .catch((e) =>
                Alert.alert('Could not approve', billingErrorMessage(e, 'Something went wrong.'))
              )
              .finally(() => setBusy(false));
          },
        },
      ]
    );
  }

  function submitReject() {
    if (!rejecting) return;
    // Required: a rejection must always carry a reason.
    if (!reason.trim()) {
      setReasonError('A reason is required to reject a payment.');
      return;
    }
    const payment = rejecting;
    const note = reason.trim();
    setBusy(true);
    setReasonError(null);
    decideClientPayment(payment, 'reject', note)
      .then(() => {
        closeReject();
        return load();
      })
      .catch((e) => setReasonError(billingErrorMessage(e, 'Could not reject the payment.')))
      .finally(() => setBusy(false));
  }

  if (loading && payments.length === 0) {
    return (
      <Card className="gap-2 p-4">
        <Text className="text-sm font-semibold">Payment requests</Text>
        <Text variant="muted" className="text-sm">
          Loading requests…
        </Text>
      </Card>
    );
  }

  if (error && payments.length === 0) {
    return (
      <Card className="gap-2 p-4">
        <Text className="text-sm font-semibold">Payment requests</Text>
        <Text variant="muted" className="text-sm">
          {error}
        </Text>
        <Button size="sm" variant="outline" className="self-start" onPress={() => void load()}>
          <Text className="text-xs font-semibold">Retry</Text>
        </Button>
      </Card>
    );
  }

  return (
    <View className="gap-4">
      <Card className="gap-3 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-sm font-semibold">Payment requests</Text>
          {payments.length > 0 ? (
            <Badge tone="warning" label={`${payments.length} awaiting approval`} />
          ) : null}
        </View>

        {payments.length === 0 ? (
          <Text variant="muted" className="text-sm">
            No incoming payment requests. When a client submits a payment it appears here for
            approval.
          </Text>
        ) : (
          payments.map((payment) => (
            <View
              key={payment.id}
              className="gap-2 rounded-xl border border-white/8 bg-white/3 p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-semibold">{payment.client_name}</Text>
                <Text className="text-sm font-medium">
                  {formatMoney(payment.invoice_info.amount)} ETB
                </Text>
              </View>
              <Text variant="muted" className="text-xs">
                {labelize(payment.channel)} · {payment.transaction_id} ·{' '}
                {shortDate(payment.created_at)}
              </Text>
              <View className="flex-row gap-2">
                <Button size="sm" disabled={busy} onPress={() => approve(payment)}>
                  <Text className="text-xs font-semibold text-primary-foreground">Approve</Text>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onPress={() => {
                    setRejecting(payment);
                    setReason('');
                    setReasonError(null);
                  }}>
                  <Text className="text-xs font-semibold text-destructive-foreground">Reject</Text>
                </Button>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Feature 14: reject pops an alert that requires a reason. */}
      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) closeReject();
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              {rejecting ? `${rejecting.client_name} · ${rejecting.transaction_id}` : ''}
            </DialogDescription>
          </DialogHeader>
          <View className="gap-2">
            <Text variant="muted" className="text-sm">
              Tell the client why this payment is rejected. They are notified right away.
            </Text>
            <Textarea
              value={reason}
              onChangeText={(t) => {
                setReason(t);
                setReasonError(null);
              }}
              placeholder="e.g. Transaction ID not found in the account"
              numberOfLines={3}
            />
            {reasonError ? (
              <Text className="text-sm text-red-600 dark:text-red-400">{reasonError}</Text>
            ) : null}
          </View>
          <DialogFooter>
            <Button size="sm" variant="outline" onPress={closeReject}>
              <Text className="text-xs font-semibold">Cancel</Text>
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onPress={submitReject}>
              <Text className="text-xs font-semibold text-destructive-foreground">
                {busy ? 'Rejecting…' : 'Reject payment'}
              </Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
