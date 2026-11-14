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

/**
 * Emergency contact storage convention.
 *
 * The backend keeps a single `emergency_contact` string; we store the name
 * and phone number as two newline-separated lines so they can be shown and
 * edited as separate fields. Legacy single-line values (name only, or just a
 * phone number) are recognised by whether the line looks like a phone number.
 */
const PHONE_LIKE = /^[+\d][\d\s()\-]+$/;

export function splitEmergencyContact(value: string | null | undefined): {
  name: string;
  phone: string;
} {
  const raw = (value ?? '').trim();
  if (!raw) return { name: '', phone: '' };
  const [first, ...rest] = raw.split('\n');
  const second = rest.join('\n').trim();
  if (second) return { name: first.trim(), phone: second };
  // Legacy single-line value. Pure number → phone; otherwise try to peel a
  // trailing phone number (e.g. "Sara Bekele +251 911 234 567") off the end;
  // treat what's left as the name.
  const line = first.trim();
  if (PHONE_LIKE.test(line)) return { name: '', phone: line };
  const mixed = line.match(/^(.*?)[\s\u00a0]*([+\d][\d\s()\-]{6,})$/);
  if (mixed && mixed[1].trim()) {
    return { name: mixed[1].trim(), phone: mixed[2].trim() };
  }
  return { name: line, phone: '' };
}

export function joinEmergencyContact(name: string, phone: string): string {
  return [name.trim(), phone.trim()].filter(Boolean).join('\n');
}
