export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

export function formatMoney(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export type AccessStateValue =
  | 'allowed'
  | 'blocked_unpaid'
  | 'blocked_no_period'
  | 'blocked_trial_expired';

/**
 * The API may report `access_state` either as a plain string (`"allowed"`) or
 * as an object (`{ state, reason }`) depending on the endpoint/serializer.
 * Normalising here keeps every screen crash-proof and consistent.
 */
export function normalizeAccessState(input: unknown): {
  state: AccessStateValue;
  reason?: string;
} {
  if (typeof input === 'string' && input.length > 0) {
    return { state: input as AccessStateValue };
  }
  if (input && typeof input === 'object') {
    const rec = input as { state?: unknown; reason?: unknown };
    if (typeof rec.state === 'string' && rec.state.length > 0) {
      return {
        state: rec.state as AccessStateValue,
        reason: typeof rec.reason === 'string' ? rec.reason : undefined,
      };
    }
  }
  return { state: 'allowed' };
}

export function labelize(value: string): string {
  if (!value) return '';
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
