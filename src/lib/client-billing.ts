import { api } from '@/lib/api';
import type { Paginated, Payment } from '@/lib/types';

export function billingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export function fetchPendingPayments(): Promise<Payment[]> {
  return api<Paginated<Payment> | Payment[]>('payments/', {
    query: { status: 'pending' },
  }).then(unwrap);
}

/**
 * Feature 14: decide an incoming payment request.
 *
 * - `approve` → invoice marked paid, client unlocked and notified
 * - `reject`  → the reason is REQUIRED (the UI blocks an empty one and the
 *               API enforces it too); it is stored in `Payment.decision_note`
 *               and pushed to the client as the rejection notification body
 */
export function decideClientPayment(
  payment: Payment,
  action: 'approve' | 'reject',
  note?: string
): Promise<Payment | { detail: string }> {
  return api<Payment | { detail: string }>(`payments/${payment.id}/decide/`, {
    method: 'POST',
    body:
      action === 'approve'
        ? { approve: true, channel: payment.channel }
        : { reject: true, note: note ?? '' },
  });
}
