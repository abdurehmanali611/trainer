import { api, ApiError } from '@/lib/api';

export type PlatformState =
  | 'trial'
  | 'trial_ending'
  | 'active'
  | 'warning'
  | 'expired'
  | 'setup_pending'
  | 'setup_required'
  | 'on_hold'
  | 'suspended'
  | 'banned'
  | 'deleted'
  | 'exempt';

export interface PlatformNotice {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
}

export interface PlatformPayment {
  id: number;
  kind: 'setup' | 'quarterly';
  status: 'pending' | 'approved' | 'rejected';
  amount_etb: number;
  channel: string;
  transaction_ref: string;
  submitted_at: string;
  review_note: string | null;
}

export interface PlatformBilling {
  state: PlatformState;
  allowed: boolean;
  setup_fee_etb: number;
  quarterly_fee_etb: number;
  setup_fee_paid: boolean;
  free_trial_ends_at: string | null;
  paid_until: string | null;
  billing_started_at: string | null;
  paid_quarters_count: number;
  billing_hold: boolean;
  is_illustration: boolean;
  days_remaining: number | null;
  window_opens_on: string | null;
  can_submit_payment: boolean;
  pending_payment: PlatformPayment | null;
  notices: PlatformNotice[];
}

export interface PlatformBillingResponse {
  billing: PlatformBilling;
  payments: PlatformPayment[];
}

export interface PlatformChatMessage {
  id: number;
  sender: 'admin' | 'trainer';
  body: string;
  image_url: string | null;
  media_urls: string[];
  is_broadcast: boolean;
  created_at: string;
}

export interface PlatformChatThread {
  id: number;
  tinNumber: string;
  hotelDisplayName: string;
  status: string;
  unreadFromTenant: number;
  updatedAt: string;
  lastMessage: { body: string; senderSide: string; createdAt: string } | null;
  subscriptionStatus: PlatformState;
}

export interface PlatformChatResponse {
  thread: PlatformChatThread;
  messages: PlatformChatMessage[];
}

export class PlatformBlockedError extends Error {
  billing: PlatformBilling;
  reason: string;

  constructor(reason: string, billing: PlatformBilling) {
    super(reason);
    this.name = 'PlatformBlockedError';
    this.reason = reason;
    this.billing = billing;
  }
}

function isBlockedBody(body: Record<string, unknown>): body is {
  blocked: true;
  reason: string;
  billing: PlatformBilling;
} {
  return body.blocked === true && !!body.billing;
}

export async function fetchPlatformBilling(): Promise<PlatformBillingResponse> {
  return api<PlatformBillingResponse>('platform/billing/');
}

export async function submitPlatformPayment(
  channel: string,
  transactionRef: string
): Promise<{ detail: string; payment_id: number; billing: PlatformBilling }> {
  return api('platform/payments/', {
    method: 'POST',
    body: { channel, transaction_ref: transactionRef },
  });
}

export async function submitLockedPlatformPayment(
  username: string,
  password: string,
  channel: string,
  transactionRef: string
): Promise<{ detail: string; payment_id: number; billing: PlatformBilling }> {
  return api('platform/payments/locked/', {
    method: 'POST',
    body: { username, password, channel, transaction_ref: transactionRef },
    auth: false,
  });
}

export async function fetchLockedPlatformBilling(
  username: string,
  password: string
): Promise<{ billing: PlatformBilling; display_name: string }> {
  return api('platform/billing/locked/', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
}

export async function fetchPlatformChat(): Promise<PlatformChatResponse> {
  return api<PlatformChatResponse>('platform/chat/');
}

export async function sendPlatformChat(
  body: string,
  mediaUrls: string[] = []
): Promise<{ id: number; created_at: string }> {
  return api('platform/chat/', {
    method: 'POST',
    body: { body, media_urls: mediaUrls },
  });
}

export async function fetchPlatformChatUnread(): Promise<{ unread: number }> {
  return api<{ unread: number }>('platform/chat/unread/');
}

export function platformErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (isBlockedBody(e.body)) return e.body.reason;
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

export const PLATFORM_STATE_LABELS: Record<PlatformState, string> = {
  trial: 'Free trial',
  trial_ending: 'Trial ending',
  active: 'Active',
  warning: 'Renewal due',
  expired: 'Payment required',
  setup_pending: 'Setup pending',
  setup_required: 'Setup payment required',
  on_hold: 'On hold',
  suspended: 'Suspended',
  banned: 'Banned',
  deleted: 'Deleted',
  exempt: 'Exempt',
};

export function platformStateLabel(state: PlatformState): string {
  return PLATFORM_STATE_LABELS[state] ?? 'Unknown';
}
