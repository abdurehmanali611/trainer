import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns';

export { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO };

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export function shortTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return iso;
  }
}

export function clockTime(time: string | null | undefined): string {
  if (!time) return '—';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export function dayLabel(iso: string): string {
  try {
    const d = parseISO(iso);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEE, MMM d');
  } catch {
    return iso;
  }
}
