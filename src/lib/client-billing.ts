import { api } from '@/lib/api';
import type { Invoice, Paginated, Payment, PaymentChannel } from '@/lib/types';

export interface BillingSummary {
  collected_this_month: number;
  pending_payments: number;
  pending_amount: number;
  overdue_invoices: number;
  by_channel: { channel: PaymentChannel; total: number }[];
}

export type InvoiceFilter = 'all' | 'pending' | 'overdue' | 'paid' | 'forgiven';

export const INVOICE_FILTERS: InvoiceFilter[] = ['all', 'pending', 'overdue', 'paid', 'forgiven'];

export function billingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function fetchBillingSummary(): Promise<BillingSummary> {
  return api<BillingSummary>('billing/summary/');
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export function fetchInvoices(status: InvoiceFilter): Promise<Invoice[]> {
  return api<Paginated<Invoice> | Invoice[]>('invoices/', {
    query: status === 'all' ? undefined : { status },
  }).then(unwrap);
}

export function fetchPendingPayments(): Promise<Payment[]> {
  return api<Paginated<Payment> | Payment[]>('payments/', {
    query: { status: 'pending' },
  }).then(unwrap);
}

export function decideClientPayment(
  payment: Payment,
  action: 'approve' | 'forgive'
): Promise<Payment | { detail: string }> {
  return api<Payment | { detail: string }>(`payments/${payment.id}/decide/`, {
    method: 'POST',
    body:
      action === 'approve'
        ? { approve: true, channel: payment.channel }
        : { forgive: true },
  });
}

export function recordClientPayment(
  invoiceId: number,
  channel: PaymentChannel,
  transactionId: string
): Promise<Payment> {
  return api<Payment>('payments/', {
    method: 'POST',
    body: { invoice_id: invoiceId, channel, transaction_id: transactionId },
  });
}
