import * as React from 'react';
import { Alert, View } from 'react-native';

import { Badge, toneForInvoice } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  INVOICE_FILTERS,
  billingErrorMessage,
  decideClientPayment,
  fetchBillingSummary,
  fetchInvoices,
  fetchPendingPayments,
  recordClientPayment,
  type BillingSummary,
  type InvoiceFilter,
} from '@/lib/client-billing';
import { shortDate } from '@/lib/dates';
import { formatMoney, labelize } from '@/lib/format';
import type { Invoice, Payment, PaymentChannel } from '@/lib/types';

const CHANNELS: PaymentChannel[] = ['cash', 'telebirr', 'bank'];

const FILTER_LABELS: Record<InvoiceFilter, string> = {
  all: 'All',
  pending: 'Pending',
  overdue: 'Overdue',
  paid: 'Paid',
  forgiven: 'Forgiven',
};

export function ClientBillingSection() {
  const [summary, setSummary] = React.useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [pendingPayments, setPendingPayments] = React.useState<Payment[]>([]);
  const [filter, setFilter] = React.useState<InvoiceFilter>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [recordingId, setRecordingId] = React.useState<number | null>(null);
  const [channel, setChannel] = React.useState<PaymentChannel>('cash');
  const [transactionRef, setTransactionRef] = React.useState('');

  const reload = React.useCallback(async () => {
    setError(null);
    try {
      const [nextSummary, nextInvoices, nextPending] = await Promise.all([
        fetchBillingSummary(),
        fetchInvoices(filter),
        fetchPendingPayments(),
      ]);
      setSummary(nextSummary);
      setInvoices(nextInvoices);
      setPendingPayments(nextPending);
    } catch (e) {
      setError(billingErrorMessage(e, 'Could not load client billing.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const decide = async (payment: Payment, action: 'approve' | 'forgive') => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await decideClientPayment(payment, action);
      setInfo(action === 'approve' ? 'Payment approved.' : 'Invoice forgiven.');
      await reload();
    } catch (e) {
      setError(billingErrorMessage(e, 'Could not update the payment.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDecide = (payment: Payment, action: 'approve' | 'forgive') => {
    const amount = `${formatMoney(payment.invoice_info.amount)} ETB`;
    Alert.alert(
      action === 'approve' ? 'Approve payment' : 'Forgive invoice',
      action === 'approve'
        ? `Mark the ${amount} payment from ${payment.client_name} as paid?`
        : `Forgive the ${amount} invoice for ${payment.client_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Forgive',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: () => void decide(payment, action),
        },
      ]
    );
  };

  const submitRecording = async () => {
    if (recordingId === null) return;
    if (!transactionRef.trim()) {
      setError('Enter the transaction ID for this payment.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const created = await recordClientPayment(recordingId, channel, transactionRef.trim());
      await decideClientPayment(created, 'approve');
      setInfo('Payment recorded and marked paid.');
      setRecordingId(null);
      setTransactionRef('');
      await reload();
    } catch (e) {
      setError(billingErrorMessage(e, 'Could not record the payment.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !summary) {
    return (
      <Card className="gap-2 p-4">
        <Text className="text-sm font-semibold">Client billing</Text>
        <Text variant="muted" className="text-sm">
          Loading invoices and payments…
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-4">
      <Card className="gap-3 p-4">
        <Text className="text-sm font-semibold">Client billing</Text>
        {summary ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Collected this month
              </Text>
              <Text className="text-sm font-medium">
                {formatMoney(summary.collected_this_month)} ETB
              </Text>
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Awaiting review
              </Text>
              <Text className="text-sm font-medium">
                {summary.pending_payments} · {formatMoney(summary.pending_amount)} ETB
              </Text>
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="text-sm">
                Overdue invoices
              </Text>
              <Text className="text-sm font-medium">{summary.overdue_invoices}</Text>
            </View>
            {summary.by_channel.length > 0 ? (
              <View className="flex-row flex-wrap gap-2 pt-1">
                {summary.by_channel.map((entry) => (
                  <Badge
                    key={entry.channel}
                    tone="info"
                    label={`${labelize(entry.channel)} · ${formatMoney(entry.total)}`}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      {pendingPayments.length > 0 ? (
        <Card className="gap-3 p-4">
          <Text className="text-sm font-semibold">Awaiting your review</Text>
          {pendingPayments.map((payment) => (
            <View key={payment.id} className="gap-2 rounded-xl border border-white/8 bg-white/3 p-3">
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
                <Button size="sm" disabled={busy} onPress={() => confirmDecide(payment, 'approve')}>
                  <Text className="text-xs font-semibold text-primary-foreground">Approve</Text>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onPress={() => confirmDecide(payment, 'forgive')}>
                  <Text className="text-xs font-semibold text-destructive-foreground">
                    Forgive
                  </Text>
                </Button>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card className="gap-3 p-4">
        <Text className="text-sm font-semibold">Invoices</Text>
        <View className="flex-row flex-wrap gap-2">
          {INVOICE_FILTERS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? 'default' : 'outline'}
              onPress={() => setFilter(option)}>
              <Text className="text-xs">{FILTER_LABELS[option]}</Text>
            </Button>
          ))}
        </View>

        {invoices.length === 0 ? (
          <Text variant="muted" className="text-sm">
            No invoices here.
          </Text>
        ) : (
          invoices.map((invoice) => (
            <View key={invoice.id} className="gap-2 rounded-xl border border-white/8 bg-white/3 p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-semibold">{invoice.client_name}</Text>
                <Badge tone={toneForInvoice[invoice.status]} label={labelize(invoice.status)} />
              </View>
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="muted" className="text-xs">
                  Due {shortDate(invoice.due_date)}
                </Text>
                <Text className="text-sm font-medium">{formatMoney(invoice.amount)} ETB</Text>
              </View>
              {invoice.period_info ? (
                <Text variant="muted" className="text-xs">
                  {shortDate(invoice.period_info.start_date)} –{' '}
                  {shortDate(invoice.period_info.end_date)}
                </Text>
              ) : null}

              {(invoice.status === 'pending' || invoice.status === 'overdue') &&
              recordingId !== invoice.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setRecordingId(invoice.id);
                    setTransactionRef('');
                    setError(null);
                    setInfo(null);
                  }}>
                  <Text className="text-xs font-semibold">Record payment</Text>
                </Button>
              ) : null}

              {recordingId === invoice.id ? (
                <View className="gap-2">
                  <View className="flex-row flex-wrap gap-2">
                    {CHANNELS.map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        variant={channel === option ? 'default' : 'outline'}
                        onPress={() => setChannel(option)}>
                        <Text className="text-xs">{labelize(option)}</Text>
                      </Button>
                    ))}
                  </View>
                  <Input
                    placeholder="Transaction ID"
                    autoCapitalize="none"
                    value={transactionRef}
                    onChangeText={setTransactionRef}
                  />
                  <View className="flex-row gap-2">
                    <Button size="sm" disabled={busy} onPress={() => void submitRecording()}>
                      <Text className="text-xs font-semibold text-primary-foreground">
                        {busy ? 'Saving…' : 'Save payment'}
                      </Text>
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => setRecordingId(null)}>
                      <Text className="text-xs font-semibold">Cancel</Text>
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}
      </Card>

      {info ? <Text className="text-xs text-emerald-600">{info}</Text> : null}
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
