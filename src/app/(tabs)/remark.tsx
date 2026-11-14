import { BadgeCheckIcon, StarIcon, UserIcon, VideoIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  Badge,
  EmptyView,
  ErrorView,
  LoadingView,
  Screen,
  toneForSession,
} from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { clockTime, dayLabel, format, shortDate } from '@/lib/dates';
import { labelize } from '@/lib/format';
import type { Paginated, Session, SessionStatus } from '@/lib/types';

type Segment = 'online' | 'offline';

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
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
    <View className="gap-2 rounded-2xl border border-border bg-card p-3.5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Icon as={mode === 'online' ? VideoIcon : UserIcon} size={16} className="text-primary" />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-sm font-semibold" numberOfLines={1}>
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
        <View className="flex-row flex-wrap gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={busy || session.status === 'approved'}
            onPress={() => onStatus(session, 'approved')}>
            <Icon as={BadgeCheckIcon} size={14} />
            <Text>Approved</Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={busy || session.status === 'no_show'}
            onPress={() => onStatus(session, 'no_show')}>
            <Text>No show</Text>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={busy || session.status === 'rescheduling'}
            onPress={() => onStatus(session, 'rescheduling')}>
            <Text>Rescheduling</Text>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            disabled={busy || session.status === 'canceled'}
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
            }>
            <Text>Cancelling</Text>
          </Button>
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
                  className={
                    star <= session.rating! ? 'text-amber-400' : 'text-muted-foreground/30'
                  }
                />
              ))}
              <Text variant="muted" className="ml-1 text-xs">
                {session.rating}/5
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
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
          <View className="flex-row gap-2 rounded-2xl border border-border bg-card p-1.5">
            {(
              [
                { key: 'online', label: `Remark online (${onlineQueue.length})` },
                { key: 'offline', label: `Remark offline (${offlineList.length})` },
              ] as { key: Segment; label: string }[]
            ).map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setSegment(tab.key)}
                className={
                  'flex-1 items-center rounded-xl px-3 py-2.5 ' +
                  (segment === tab.key ? 'bg-primary' : 'active:opacity-70')
                }
                accessibilityRole="tab"
                accessibilityState={{ selected: segment === tab.key }}>
                <Text
                  className={
                    'text-xs font-semibold ' +
                    (segment === tab.key ? 'text-primary-foreground' : 'text-muted-foreground')
                  }
                  numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text variant="muted" className="text-xs">
            {segment === 'online'
              ? 'Sessions with you — set the outcome: approved, no show, rescheduling or cancelling.'
              : "Sessions without you — what you see is what the client marked; read-only, nothing to approve."}
          </Text>

          {rows.length === 0 ? (
            <EmptyView
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
