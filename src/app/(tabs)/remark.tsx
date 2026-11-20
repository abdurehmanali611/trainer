import {
  BadgeCheckIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  InfoIcon,
  StarIcon,
  UserIcon,
  UserXIcon,
  VideoIcon,
  XCircleIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { alpha, COLORS, Panel, Segmented } from '@/components/kit';
import {
  Badge,
  EmptyView,
  ErrorView,
  LoadingView,
  Screen,
  toneForSession,
} from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { clockTime, dayLabel, format } from '@/lib/dates';
import { labelize } from '@/lib/format';
import type { Paginated, Session, SessionStatus } from '@/lib/types';

type Segment = 'online' | 'offline';

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

const OUTCOME_TONES = {
  success: {
    box: 'border-emerald-500/40 bg-emerald-500/10',
    activeBox: 'border-emerald-500 bg-emerald-500',
    text: 'text-emerald-400',
    icon: '#34D399',
  },
  warning: {
    box: 'border-amber-500/40 bg-amber-500/10',
    activeBox: 'border-amber-500 bg-amber-500',
    text: 'text-amber-400',
    icon: '#FBBF24',
  },
  info: {
    box: 'border-sky-500/40 bg-sky-500/10',
    activeBox: 'border-sky-500 bg-sky-500',
    text: 'text-sky-400',
    icon: '#38BDF8',
  },
  danger: {
    box: 'border-red-500/40 bg-red-500/10',
    activeBox: 'border-red-500 bg-red-500',
    text: 'text-red-400',
    icon: '#F87171',
  },
} as const;

/** One outcome choice for an online session: tinted pill, filled when current. */
function OutcomeButton({
  label,
  icon,
  tone,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>['as'];
  tone: keyof typeof OUTCOME_TONES;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = OUTCOME_TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || active}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: disabled || active }}
      className={
        'h-11 min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-2 active:opacity-70 ' +
        (active ? styles.activeBox : styles.box) +
        (disabled && !active ? ' opacity-50' : '')
      }>
      <Icon as={icon} size={15} color={active ? '#FFFFFF' : styles.icon} />
      <Text
        numberOfLines={1}
        className={'text-[13px] font-semibold ' + (active ? 'text-white' : styles.text)}>
        {label}
      </Text>
    </Pressable>
  );
}

function SessionRow({
  session,
  mode,
  busy,
  onStatus,
}: {
  session: Session;
  mode: Segment;
  busy: boolean;
  onStatus: (session: Session, status: SessionStatus) => void;
}) {
  return (
    <Panel tint={mode === 'online' ? COLORS.cyan : COLORS.violet} className="gap-2 p-3.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: alpha(mode === 'online' ? COLORS.cyan : COLORS.violet, 0.18),
              borderWidth: 1,
              borderColor: alpha(mode === 'online' ? COLORS.cyan : COLORS.violet, 0.4),
            }}>
            <Icon
              as={mode === 'online' ? VideoIcon : UserIcon}
              size={17}
              color={mode === 'online' ? COLORS.cyan : COLORS.violet}
            />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-[15px] font-bold" numberOfLines={1}>
              {session.client_name}
            </Text>
            <Text variant="muted" className="text-xs">
              {dayLabel(session.date)} · {clockTime(session.time)} · {session.duration_minutes} min
            </Text>
          </View>
        </View>
        <Badge label={labelize(session.status)} tone={toneForSession[session.status] ?? 'info'} />
      </View>

      {session.notes ? (
        <Text variant="muted" className="text-xs" numberOfLines={2}>
          {session.notes}
        </Text>
      ) : null}

      {mode === 'online' ? (
        // Feature 21: the four remark-online outcomes.
        <View className="mt-1 gap-2">
          <View className="flex-row gap-2">
            <OutcomeButton
              label="No show"
              icon={UserXIcon}
              tone="warning"
              active={session.status === 'no_show'}
              disabled={busy}
              onPress={() => onStatus(session, 'no_show')}
            />
            <OutcomeButton
              label="Approved"
              icon={BadgeCheckIcon}
              tone="success"
              active={session.status === 'approved'}
              disabled={busy}
              onPress={() => onStatus(session, 'approved')}
            />
          </View>
          <View className="flex-row gap-2">
            <OutcomeButton
              label="Rescheduling"
              icon={CalendarClockIcon}
              tone="info"
              active={session.status === 'rescheduling'}
              disabled={busy}
              onPress={() => onStatus(session, 'rescheduling')}
            />
            <OutcomeButton
              label="Cancelling"
              icon={XCircleIcon}
              tone="danger"
              active={session.status === 'canceled'}
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Cancelling',
                  `Mark the online session with ${session.client_name} as cancelling?`,
                  [
                    { text: 'Back', style: 'cancel' },
                    {
                      text: 'Cancelling',
                      style: 'destructive',
                      onPress: () => onStatus(session, 'canceled'),
                    },
                  ]
                )
              }
            />
          </View>
        </View>
      ) : (
        // Feature 25: remark OFFLINE is read-only — the trainer only sees
        // whether the client finished the session or not. No action buttons.
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text variant="muted" className="text-xs">
              Client finished this session?
            </Text>
            <Badge
              label={
                session.status === 'completed' || session.status === 'approved'
                  ? 'Finished'
                  : 'Not finished'
              }
              tone={
                session.status === 'completed' || session.status === 'approved'
                  ? 'success'
                  : 'warning'
              }
            />
          </View>
          {session.rating != null ? (
            <View className="flex-row items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                  key={star}
                  as={StarIcon}
                  size={14}
                  color={star <= session.rating! ? COLORS.amber : alpha(COLORS.muted, 0.3)}
                />
              ))}
              <Text variant="muted" className="ml-1 text-xs">
                {session.rating}/5
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Panel>
  );
}

export default function RemarkScreen() {
  const [segment, setSegment] = React.useState<Segment>('online');
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const load = React.useCallback(async (initial?: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      // Wider window than the schedule: remark history matters more than the
      // week ahead — the past month of client-finished sessions and the next
      // month of online sessions awaiting approval.
      const from = format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd');
      const to = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd');
      const res = await api<Paginated<Session>>('sessions/', { query: { from, to } });
      setSessions(unwrap(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(true);
  }, [load]);

  const onlineQueue = React.useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.is_online && (s.status === 'scheduled' || s.status === 'rescheduling')
        )
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [sessions]
  );

  // Feature 25: remark offline lists recent offline sessions and shows,
  // read-only, whether each was finished by the client or not.
  const offlineList = React.useMemo(
    () =>
      sessions
        .filter((s) => !s.is_online)
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
        .slice(0, 30),
    [sessions]
  );

  const rows = segment === 'online' ? onlineQueue : offlineList;

  async function updateStatus(session: Session, status: SessionStatus) {
    setBusyId(session.id);
    try {
      const updated = await api<Session>(`sessions/${session.id}/`, {
        method: 'PATCH',
        body: { status },
      });
      setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  function onStatus(session: Session, status: SessionStatus) {
    void updateStatus(session, status);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={() => void load()}>
      {error ? (
        <ErrorView error={error} onRetry={() => void load(true)} />
      ) : loading ? (
        <LoadingView label="Loading sessions…" />
      ) : (
        <View className="gap-4">
          <Segmented<Segment>
            value={segment}
            onChange={setSegment}
            options={[
              { key: 'online', label: `Online (${onlineQueue.length})`, icon: VideoIcon },
              { key: 'offline', label: `Offline (${offlineList.length})`, icon: UserIcon },
            ]}
          />

          <View
            className="flex-row items-start gap-2.5 rounded-2xl p-3"
            style={{ backgroundColor: alpha(COLORS.sky, 0.09), borderWidth: 1, borderColor: alpha(COLORS.sky, 0.28) }}>
            <Icon as={InfoIcon} size={16} color={COLORS.sky} />
            <Text variant="muted" className="flex-1 text-xs">
              {segment === 'online'
                ? 'Sessions with you — set the outcome: approved, no show, rescheduling or cancelling.'
                : 'Sessions without you — what you see is what the client marked; read-only, nothing to approve.'}
            </Text>
          </View>

          {rows.length === 0 ? (
            <EmptyView
              icon={ClipboardCheckIcon}
              color={segment === 'online' ? COLORS.cyan : COLORS.violet}
              title={segment === 'online' ? 'Nothing to remark' : 'No offline sessions yet'}
              subtitle={
                segment === 'online'
                  ? 'Online sessions you scheduled will appear here for remarking.'
                  : 'Offline sessions show up here with the client\'s finished/not-finished status.'
              }
            />
          ) : (
            <View className="gap-3">
              {rows.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  mode={segment}
                  busy={busyId === session.id}
                  onStatus={onStatus}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
