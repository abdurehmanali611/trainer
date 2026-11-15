import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { CalendarPlusIcon, DumbbellIcon, NotebookPenIcon, UserIcon, VideoIcon } from 'lucide-react-native';

import { Badge, EmptyView, ErrorView, LoadingView, Screen, toneForRequest, toneForSession } from '@/components/screen';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogSection,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SwipeRail } from '@/components/swipe-rail';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Combobox } from '@/components/ui/combobox';
import { DatePopoverField, TimePopoverField } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import { clockTime, dayLabel, format, shortDate, todayISO } from '@/lib/dates';
import type {
  Client,
  DietPlan,
  Paginated,
  PermissionRequest,
  RescheduleRequest,
  Session,
  SessionStatus,
  WorkoutPlan,
} from '@/lib/types';

type TabValue = 'sessions' | 'requests';
type DecideTarget = {
  type: 'reschedule' | 'permission';
  id: number;
  clientName: string;
  subtitle: string;
};

type ConflictState = {
  conflicts: { id: number; kind: 'session' | 'reschedule_request'; client_name: string; date: string; time: string }[];
  /** Retry payload for the action that hit the conflict. */
  retry: () => Promise<void>;
  /** Merge target context for the add-flow merge. */
  mergeContext?: { clientId: string; notes: string; date: string; time: string } | null;
  /** For edit-flow merges: the session being moved (folded into the existing). */
  movingSessionId?: number | null;
  /** For reschedule-approve merges: the pending request id. */
  requestId?: number | null;
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  canceled: 'Canceled',
  no_show: 'No-show',
  approved: 'Approved',
  rescheduling: 'Rescheduling',
};

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results;
}

/** Minutes between the draft's start and end date/time; <= 0 when invalid. */
function sessionSpanMinutes(draft: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}): number {
  const start = Date.parse(`${draft.startDate}T${draft.startTime}:00`);
  const end = Date.parse(`${draft.endDate}T${draft.endTime}:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 60000);
}

function SessionRow({ session, onPress }: { session: Session; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm shadow-black/30 active:opacity-70">
      <View className="w-16 gap-0.5">
        <Text className="font-semibold">{clockTime(session.time)}</Text>
        <Text variant="muted" className="text-xs">
          {session.duration_minutes} min
        </Text>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-sm font-medium" numberOfLines={1}>
          {session.client_name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Icon
            as={session.is_online ? VideoIcon : UserIcon}
            size={13}
            className="text-muted-foreground"
          />
          <Text variant="muted" className="text-xs">
            {session.is_online ? 'Online' : 'In person'}
          </Text>
        </View>
      </View>
      <Badge
        label={STATUS_LABELS[session.status] ?? session.status}
        tone={toneForSession[session.status] ?? 'info'}
      />
    </Pressable>
  );
}

function RequestRow({
  title,
  meta,
  reason,
  statusLabel,
  statusTone,
  onReview,
}: {
  title: string;
  meta: string;
  reason: string;
  statusLabel: string;
  statusTone: 'success' | 'danger' | 'warning';
  onReview: () => void;
}) {
  return (
    <View className="gap-2 rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/30">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm font-medium" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="muted" className="text-xs">
            {meta}
          </Text>
        </View>
        <Badge label={statusLabel} tone={statusTone} />
      </View>
      {reason ? (
        <Text variant="muted" className="text-sm">
          {reason}
        </Text>
      ) : null}
      <Button size="sm" variant="outline" className="self-start" onPress={onReview}>
        <Text>Review</Text>
      </Button>
    </View>
  );
}

export default function ScheduleScreen() {
  const [tab, setTab] = React.useState<TabValue>('sessions');
  const [lit, setLit] = React.useState<0 | 1>(0);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [reschedules, setReschedules] = React.useState<RescheduleRequest[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionRequest[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [activeSession, setActiveSession] = React.useState<Session | null>(null);
  const [edit, setEdit] = React.useState<{
    id: number;
    date: string;
    time: string;
    duration: string;
    notes: string;
    isOnline: boolean;
  } | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    clientId: '',
    startDate: todayISO(),
    startTime: '09:00',
    endDate: todayISO(),
    endTime: '10:00',
    notes: '',
    isOnline: false,
    workoutIds: [] as string[],
    dietIds: [] as string[],
  });
  const [attachableWorkouts, setAttachableWorkouts] = React.useState<{ id: number; name: string }[]>([]);
  const [attachableDiets, setAttachableDiets] = React.useState<{ id: number; name: string }[]>([]);
  const [adding, setAdding] = React.useState(false);

  // Load the attachable plan catalogue once, the first time the add dialog opens.
  React.useEffect(() => {
    if (!addOpen || attachableWorkouts.length > 0 || attachableDiets.length > 0) return;
    Promise.allSettled([
      api<Paginated<WorkoutPlan>>('workout-plans/'),
      api<Paginated<DietPlan>>('diet-plans/'),
    ]).then(([workouts, diets]) => {
      if (workouts.status === 'fulfilled') {
        setAttachableWorkouts(
          (workouts.value.results ?? []).map((plan) => ({ id: plan.id, name: plan.name }))
        );
      }
      if (diets.status === 'fulfilled') {
        setAttachableDiets(
          (diets.value.results ?? []).map((plan) => ({ id: plan.id, name: plan.name }))
        );
      }
    });
  }, [addOpen, attachableWorkouts.length, attachableDiets.length]);
  const [decideTarget, setDecideTarget] = React.useState<DecideTarget | null>(null);
  const [decideNote, setDecideNote] = React.useState('');
  const [deciding, setDeciding] = React.useState(false);
  // Feature 23: "Approve with reschedule" needs the trainer's chosen slot.
  const [decideNewDate, setDecideNewDate] = React.useState('');
  const [decideNewTime, setDecideNewTime] = React.useState('');
  const [decideWithRescheduleOpen, setDecideWithRescheduleOpen] = React.useState(false);
  // Feature 24: when the backend answers 409 schedule_conflict, the trainer
  // chooses Merge-with-existing or Cancel-the-existing schedule.
  const [conflict, setConflict] = React.useState<ConflictState | null>(null);
  const [conflictBusy, setConflictBusy] = React.useState(false);

  /** Pull the conflict list out of a 409 schedule_conflict response. */
  function conflictsOf(e: unknown): ConflictState['conflicts'] | null {
    if (
      e instanceof ApiError &&
      e.status === 409 &&
      Array.isArray((e.body as { conflicts?: unknown }).conflicts)
    ) {
      return (e.body as { conflicts: ConflictState['conflicts'] }).conflicts;
    }
    return null;
  }

  const load = React.useCallback(async (initial?: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const from = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd');
      const to = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd');
      const [sessionRes, rescheduleRes, permissionRes, clientRes] = await Promise.all([
        api<Paginated<Session>>('sessions/', { query: { from, to } }),
        api<RescheduleRequest[] | Paginated<RescheduleRequest>>('requests/', {
          query: { type: 'reschedule', status: 'pending' },
        }),
        api<PermissionRequest[] | Paginated<PermissionRequest>>('requests/', {
          query: { type: 'permission', status: 'pending' },
        }),
        api<Paginated<Client>>('clients/', { query: { page_size: 200 } }),
      ]);
      setSessions(sessionRes.results);
      setReschedules(unwrap(rescheduleRes));
      setPermissions(unwrap(permissionRes));
      setClients(clientRes.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(true);
  }, [load]);

  const groups = React.useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      const existing = map.get(session.date);
      if (existing) existing.push(session);
      else map.set(session.date, [session]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  const pendingCount = reschedules.length + permissions.length;

  async function setStatus(status: SessionStatus) {
    if (!activeSession) return;
    const target = activeSession;
    try {
      const updated = await api<Session>(`sessions/${target.id}/`, {
        method: 'PATCH',
        body: { status },
      });
      setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      setActiveSession(null);
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function openEdit() {
    if (!activeSession) return;
    setEdit({
      id: activeSession.id,
      date: activeSession.date,
      time: activeSession.time,
      duration: String(activeSession.duration_minutes),
      notes: activeSession.notes,
      isOnline: activeSession.is_online,
    });
    setActiveSession(null);
  }

  async function saveEdit() {
    if (!edit) return;
    if (!edit.date.trim() || !edit.time.trim()) {
      Alert.alert('Missing fields', 'Date and time are required.');
      return;
    }
    const attempt = async () => {
      const updated = await api<Session>(`sessions/${edit.id}/`, {
        method: 'PATCH',
        body: {
          date: edit.date.trim(),
          time: edit.time.trim(),
          duration_minutes: Math.max(1, parseInt(edit.duration, 10) || 60),
          notes: edit.notes,
          is_online: edit.isOnline,
        },
      });
      setSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      setEdit(null);
    };
    try {
      await attempt();
    } catch (e) {
      const conflicts = conflictsOf(e);
      if (conflicts) {
        // Feature 24: offer Merge-with-existing or Cancel-the-existing.
        setConflict({
          conflicts,
          retry: attempt,
          movingSessionId: edit.id,
        });
        return;
      }
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function confirmDeleteSession() {
    if (!activeSession) return;
    const target = activeSession;
    Alert.alert('Delete session?', `${target.client_name} · ${dayLabel(target.date)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`sessions/${target.id}/`, { method: 'DELETE' });
            setSessions((list) => list.filter((s) => s.id !== target.id));
            setActiveSession(null);
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  async function addSession() {
    if (!draft.clientId) {
      Alert.alert('Missing client', 'Pick a client for the session.');
      return;
    }
    if (!draft.startDate || !draft.startTime || !draft.endDate || !draft.endTime) {
      Alert.alert('Missing fields', 'Start and end date/time are required.');
      return;
    }
    const span = sessionSpanMinutes(draft);
    if (span <= 0) {
      Alert.alert('Invalid range', 'End date/time must be after the start date/time.');
      return;
    }
    const attempt = async () => {
      const created = await api<Session>('sessions/', {
        method: 'POST',
        body: {
          client: Number(draft.clientId),
          date: draft.startDate,
          time: draft.startTime,
          end_date: draft.endDate,
          end_time: draft.endTime,
          duration_minutes: span,
          notes: draft.notes,
          is_online: draft.isOnline,
          recommended_workouts: draft.workoutIds.map(Number),
          recommended_diets: draft.dietIds.map(Number),
        },
      });
      setSessions((list) =>
        [...list, created].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      );
      setAddOpen(false);
      setDraft((d) => ({ ...d, notes: '', workoutIds: [], dietIds: [] }));
    };
    setAdding(true);
    try {
      await attempt();
    } catch (e) {
      const conflicts = conflictsOf(e);
      if (conflicts) {
        // Feature 24: the new session collides — offer Merge (fold the new
        // context into the existing schedule) or Cancel-the-existing.
        setConflict({
          conflicts,
          retry: attempt,
          mergeContext: {
            clientId: draft.clientId,
            notes: draft.notes,
            date: draft.startDate,
            time: draft.startTime,
          },
        });
      } else {
        Alert.alert(
          'Could not add session',
          e instanceof Error ? e.message : 'Something went wrong.'
        );
      }
    } finally {
      setAdding(false);
    }
  }

  async function resolveConflictMerge() {
    if (!conflict) return;
    setConflictBusy(true);
    try {
      const target = conflict.conflicts.find((c) => c.kind === 'session') ?? conflict.conflicts[0];
      if (target.kind === 'session') {
        if (conflict.movingSessionId) {
          // Edit-flow: fold the moved session into the existing schedule.
          await api(`sessions/${target.id}/merge/`, {
            method: 'POST',
            body: { merge_id: conflict.movingSessionId },
          });
        } else {
          // Add-flow: fold the unsaved context into the existing schedule.
          await api(`sessions/${target.id}/merge/`, {
            method: 'POST',
            body: {
              client_id: conflict.mergeContext ? Number(conflict.mergeContext.clientId) : undefined,
              notes: conflict.mergeContext?.notes,
              date: conflict.mergeContext?.date,
              time: conflict.mergeContext?.time,
            },
          });
        }
      } else if (conflict.requestId) {
        // Reschedule-request conflict: merge the request into the schedule.
        await api(`requests/reschedule/${conflict.requestId}/decide/`, {
          method: 'POST',
          body: { decision: 'merge', note: decideNote.trim() || undefined },
        });
      }
      setEdit(null);
      setAddOpen(false);
      setDecideTarget(null);
      setConflict(null);
      await load();
    } catch (e) {
      Alert.alert(
        'Could not merge',
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setConflictBusy(false);
    }
  }

  async function resolveConflictCancelExisting() {
    if (!conflict) return;
    setConflictBusy(true);
    try {
      // Feature 24: cancel the conflicting schedule(s) so the new time can
      // take it, then retry the original action.
      const cancellables = conflict.conflicts.filter((c) => c.kind === 'session');
      for (const item of cancellables) {
        await api(`sessions/${item.id}/`, { method: 'PATCH', body: { status: 'canceled' } });
      }
      await conflict.retry();
      setConflict(null);
      await load();
    } catch (e) {
      Alert.alert(
        'Could not reschedule',
        e instanceof Error ? e.message : 'Something went wrong.'
      );
    } finally {
      setConflictBusy(false);
    }
  }

  function openDecide(target: DecideTarget) {
    setDecideNote('');
    setDecideNewDate('');
    setDecideNewTime('');
    setDecideWithRescheduleOpen(false);
    setDecideTarget(target);
  }

  type Decision = 'approve' | 'approve_with_reschedule' | 'decline';

  async function decide(decision: Decision) {
    if (!decideTarget) return;
    if (decision === 'approve_with_reschedule' && (!decideNewDate.trim() || !decideNewTime.trim())) {
      Alert.alert(
        'Pick a time',
        'Approve-with-reschedule needs the new date and time.'
      );
      return;
    }
    setDeciding(true);
    const isReschedule = decideTarget.type === 'reschedule';
    const path = isReschedule
      ? `requests/reschedule/${decideTarget.id}/decide/`
      : `requests/permission/${decideTarget.id}/decide/`;
    const body: Record<string, unknown> =
      isReschedule
        ? {
            decision,
            note: decideNote.trim() || undefined,
            ...(decision === 'approve_with_reschedule'
              ? { new_date: decideNewDate.trim(), new_time: decideNewTime.trim() }
              : {}),
          }
        : // Permission requests keep the legacy boolean contract.
          { approve: decision === 'approve', note: decideNote.trim() || undefined };
    const attempt = async () => {
      await api(path, { method: 'POST', body });
      if (isReschedule) {
        setReschedules((list) => list.filter((r) => r.id !== decideTarget.id));
      } else {
        setPermissions((list) => list.filter((p) => p.id !== decideTarget.id));
      }
      setDecideTarget(null);
      setDecideNote('');
    };
    try {
      await attempt();
    } catch (e) {
      const conflicts = conflictsOf(e);
      if (conflicts && isReschedule) {
        // Feature 22/24: the requested (or trainer-picked) slot conflicts —
        // offer Merge or Cancel-the-existing, then retry the decision.
        setConflict({
          conflicts,
          retry: attempt,
          requestId: decideTarget.id,
        });
      } else {
        Alert.alert('Decision failed', e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      setDeciding(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading schedule…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false}>
        <ErrorView error={error} onRetry={() => void load(true)} />
      </Screen>
    );
  }

  const draftSpan = sessionSpanMinutes(draft);

  return (
    <Screen refreshing={refreshing} onRefresh={() => void load()}>
      {tab === 'sessions' ? (
        <>
          <View className="mb-5 mt-5 flex-row justify-end">
            <Button
              size="sm"
              className="px-5"
              onPress={() => {
                setDraft({
                  clientId: '',
                  startDate: todayISO(),
                  startTime: '09:00',
                  endDate: todayISO(),
                  endTime: '10:00',
                  notes: '',
                  isOnline: false,
                  workoutIds: [],
                  dietIds: [],
                });
                setAddOpen(true);
              }}>
              <Icon as={CalendarPlusIcon} size={16} />
              <Text>Add</Text>
            </Button>
          </View>
          <View className="mb-1.25 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1 gap-0.5 pt-1">
              <Text variant="h2">Sessions</Text>
              <Text variant="muted" className="text-xs">
                {`${sessions.length} scheduled`}
              </Text>
            </View>
            <SwipeRail
              direction="forward"
              label="Swipe to Requests"
              lit={lit}
              onLitChange={setLit}
              onPress={() => setTab('requests')}
            />
          </View>
        </>
      ) : (
        <View className="mb-4 mt-2 flex-row items-start justify-between gap-3">
          <View className="flex-row items-center gap-2 pt-1">
            <Text variant="h2">Requests</Text>
            {pendingCount > 0 ? (
              <View className="rounded-full bg-destructive px-1.5">
                <Text className="text-xs font-semibold text-white">{pendingCount}</Text>
              </View>
            ) : null}
          </View>
          <SwipeRail
            direction="back"
            label="Swipe to Sessions"
            onPress={() => setTab('sessions')}
          />
        </View>
      )}

      {tab === 'sessions' ? (
        <View className="gap-4">
          {sessions.length === 0 ? (
            <EmptyView
              title="No sessions"
              subtitle="Sessions between this week and the next month show up here."
              action={
                <Button onPress={() => setAddOpen(true)}>
                  <Text>Add session</Text>
                </Button>
              }
            />
          ) : (
            groups.map(([date, items]) => (
              <Section key={date} title={dayLabel(date)} className="gap-2.5">
                {items.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onPress={() => setActiveSession(session)}
                  />
                ))}
              </Section>
            ))
          )}
        </View>
      ) : (
        <View className="gap-4">
          <Section title="Reschedule requests" className="gap-3">
            {reschedules.length === 0 ? (
              <Text variant="muted">No pending reschedule requests.</Text>
            ) : (
              reschedules.map((request) => (
                <RequestRow
                  key={request.id}
                  title={request.client_name}
                  meta={`Wants ${shortDate(request.requested_date)}${
                    request.requested_time ? ` at ${clockTime(request.requested_time)}` : ''
                  }`}
                  reason={request.reason}
                  statusLabel={request.status}
                  statusTone={toneForRequest[request.status] ?? 'warning'}
                  onReview={() =>
                    openDecide({
                      type: 'reschedule',
                      id: request.id,
                      clientName: request.client_name,
                      subtitle: `Requested ${shortDate(request.requested_date)}${
                        request.requested_time ? ` at ${clockTime(request.requested_time)}` : ''
                      }`,
                    })
                  }
                />
              ))
            )}
          </Section>

          <Section title="Permission requests" className="gap-3">
            {permissions.length === 0 ? (
              <Text variant="muted">No pending permission requests.</Text>
            ) : (
              permissions.map((request) => (
                <RequestRow
                  key={request.id}
                  title={request.client_name}
                  meta={`${request.kind === 'late' ? 'Late' : 'Absent'} · ${shortDate(request.date)}`}
                  reason={request.reason}
                  statusLabel={request.status}
                  statusTone={toneForRequest[request.status] ?? 'warning'}
                  onReview={() =>
                    openDecide({
                      type: 'permission',
                      id: request.id,
                      clientName: request.client_name,
                      subtitle: `${request.kind === 'late' ? 'Late' : 'Absent'} · ${shortDate(request.date)}`,
                    })
                  }
                />
              ))
            )}
          </Section>
        </View>
      )}

      <Dialog
        open={activeSession !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSession(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeSession?.client_name}</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `${dayLabel(activeSession.date)} · ${clockTime(activeSession.time)} · ${activeSession.duration_minutes} min`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <View className="gap-2">
            {activeSession?.is_online ? (
              // Feature 21: remark ONLINE — the trainer sets one of the four
              // outcomes for the online session.
              <>
                <Text variant="muted" className="text-xs">
                  Remark online — set the session outcome.
                </Text>
                <Button
                  variant="outline"
                  disabled={activeSession?.status === 'approved'}
                  onPress={() => void setStatus('approved')}>
                  <Text>Approved</Text>
                </Button>
                <Button
                  variant="outline"
                  disabled={activeSession?.status === 'no_show'}
                  onPress={() => void setStatus('no_show')}>
                  <Text>No show</Text>
                </Button>
                <Button
                  variant="outline"
                  disabled={activeSession?.status === 'rescheduling'}
                  onPress={() => void setStatus('rescheduling')}>
                  <Text>Rescheduling</Text>
                </Button>
                <Button
                  variant="outline"
                  disabled={activeSession?.status === 'canceled'}
                  onPress={() => void setStatus('canceled')}>
                  <Text>Cancelling</Text>
                </Button>
              </>
            ) : (
              // Feature 25: remark OFFLINE is read-only — the trainer only
              // sees whether the client finished the session or not.
              <>
                <Text variant="muted" className="text-xs">
                  Remark offline — set by the client.
                </Text>
                <View className="flex-row items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                  <Text className="text-sm">Finished</Text>
                  <Badge
                    label={
                      activeSession?.status === 'completed' || activeSession?.status === 'approved'
                        ? 'Finished'
                        : 'Not finished'
                    }
                    tone={
                      activeSession?.status === 'completed' || activeSession?.status === 'approved'
                        ? 'success'
                        : 'warning'
                    }
                  />
                </View>
              </>
            )}
            <Button variant="outline" onPress={openEdit}>
              <Text>Edit session</Text>
            </Button>
            <Button variant="destructive" onPress={confirmDeleteSession}>
              <Text>Delete session</Text>
            </Button>
          </View>
        </DialogContent>
      </Dialog>

      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
            <DialogDescription>Change the date, time or details.</DialogDescription>
          </DialogHeader>
          {edit ? (
            <DialogBody contentContainerClassName="gap-3">
              <DialogSection icon={CalendarPlusIcon} label="Session details">
              <View className="flex-row gap-3">
                <Input
                  className="flex-1"
                  value={edit.date}
                  onChangeText={(v) => setEdit({ ...edit, date: v })}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
                <Input
                  className="flex-1"
                  value={edit.time}
                  onChangeText={(v) => setEdit({ ...edit, time: v })}
                  placeholder="HH:MM"
                  autoCapitalize="none"
                />
              </View>
              <View className="flex-row items-center gap-3">
                <Input
                  className="flex-1"
                  value={edit.duration}
                  onChangeText={(v) => setEdit({ ...edit, duration: v })}
                  placeholder="Duration (min)"
                  keyboardType="number-pad"
                />
                <View className="flex-row items-center gap-2">
                  <Text variant="muted">Online</Text>
                  <Switch
                    checked={edit.isOnline}
                    onCheckedChange={(checked) => setEdit({ ...edit, isOnline: checked })}
                  />
                </View>
              </View>
              <Input
                value={edit.notes}
                onChangeText={(v) => setEdit({ ...edit, notes: v })}
                placeholder="Notes"
              />
              </DialogSection>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setEdit(null)}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={() => void saveEdit()}>
              <Text>Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
        }}>
        <DialogContent className="w-2xl max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Add session</DialogTitle>
            <DialogDescription>Schedule a new session with a client.</DialogDescription>
          </DialogHeader>
          <DialogBody contentContainerClassName="gap-4">
            {/* Client */}
            <DialogSection icon={UserIcon} label="Client">
              <Combobox
                value={draft.clientId}
                onValueChange={(value) => setDraft((d) => ({ ...d, clientId: value }))}
                options={clients.map((client) => ({
                  value: String(client.id),
                  label: client.name,
                  hint: client.phone || undefined,
                }))}
                placeholder="Pick a client"
                searchPlaceholder="Search clients…"
                align="left"
                emptyText="No clients yet"
                className="w-full"
              />
            </DialogSection>

            {/* When */}
            <DialogSection icon={CalendarPlusIcon} label="When">
              <View className="gap-3">
                <View className="gap-3 web:flex-row">
                  <DatePopoverField
                    label="Start date"
                    value={draft.startDate}
                    onChange={(iso) =>
                      setDraft((d) => ({ ...d, startDate: iso, endDate: iso }))
                    }
                    className="flex-1"
                  />
                  <TimePopoverField
                    label="Start time"
                    value={draft.startTime}
                    onChange={(time) => setDraft((d) => ({ ...d, startTime: time }))}
                    className="flex-1"
                  />
                </View>
                <View className="gap-3 web:flex-row">
                  <DatePopoverField
                    label="End date"
                    value={draft.endDate}
                    onChange={(iso) => setDraft((d) => ({ ...d, endDate: iso }))}
                    className="flex-1"
                  />
                  <TimePopoverField
                    label="End time"
                    value={draft.endTime}
                    onChange={(time) => setDraft((d) => ({ ...d, endTime: time }))}
                    className="flex-1"
                  />
                </View>
              </View>
            </DialogSection>

            {/* Online session */}
            <DialogSection
              className={
                'flex-row items-center justify-between gap-3 ' +
                (draft.isOnline ? 'border-primary/40 bg-primary/5' : '')
              }>
              <View className="min-w-0 flex-1 flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon as={VideoIcon} size={18} className="text-primary" />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">Online session</Text>
                  <Text variant="muted" className="text-xs">
                    {draftSpan > 0
                      ? `${Math.floor(draftSpan / 60)}h ${draftSpan % 60}m · ends ${clockTime(
                          draft.endTime
                        )}`
                      : 'End must be after start'}
                  </Text>
                </View>
              </View>
              <Switch
                checked={draft.isOnline}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, isOnline: checked }))}
              />
            </DialogSection>

            {/* Attach plans */}
            <DialogSection icon={DumbbellIcon} label="Attach plans">
              <View className="gap-3 web:flex-row">
                <View className="gap-1.5 web:flex-1">
                  <Text variant="muted" className="text-xs font-medium">
                    Workouts
                  </Text>
                  <Combobox
                    multiple
                    value={draft.workoutIds}
                    onValueChange={(values) => setDraft((d) => ({ ...d, workoutIds: values }))}
                    options={attachableWorkouts.map((plan) => ({
                      value: String(plan.id),
                      label: plan.name,
                    }))}
                    placeholder="Pick workout plans"
                    searchPlaceholder="Search workouts…"
                    align="left"
                    emptyText="Create a workout plan first to attach it."
                    className="w-full"
                  />
                </View>
                <View className="gap-1.5 web:flex-1">
                  <Text variant="muted" className="text-xs font-medium">
                    Diet plans
                  </Text>
                  <Combobox
                    multiple
                    value={draft.dietIds}
                    onValueChange={(values) => setDraft((d) => ({ ...d, dietIds: values }))}
                    options={attachableDiets.map((plan) => ({
                      value: String(plan.id),
                      label: plan.name,
                    }))}
                    placeholder="Pick diet plans"
                    searchPlaceholder="Search diets…"
                    align="left"
                    emptyText="Create a diet plan first to attach it."
                    className="w-full"
                  />
                </View>
              </View>
            </DialogSection>

            {/* Notes */}
            <DialogSection icon={NotebookPenIcon} label="Notes">
              <Textarea
                value={draft.notes}
                onChangeText={(v) => setDraft((d) => ({ ...d, notes: v }))}
                placeholder="Focus, reminders, client context…"
              />
            </DialogSection>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onPress={() => setAddOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button disabled={adding} onPress={() => void addSession()}>
              <Icon as={CalendarPlusIcon} size={16} />
              <Text>{adding ? 'Adding…' : 'Add session'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={decideTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDecideTarget(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review request</DialogTitle>
            <DialogDescription>
              {decideTarget ? `${decideTarget.clientName} · ${decideTarget.subtitle}` : ''}
            </DialogDescription>
          </DialogHeader>
          {decideTarget?.type === 'reschedule' ? (
            // Feature 23: three decisions — Approve (the client's requested
            // time), Approve with reschedule (trainer picks a conflict-free
            // time), or Decline.
            <>
              <Input
                value={decideNote}
                onChangeText={setDecideNote}
                placeholder="Note to client (optional)"
              />
              {decideWithRescheduleOpen ? (
                <View className="gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <Text variant="muted" className="text-xs font-medium">
                    Trainer conflict-free slot
                  </Text>
                  <View className="flex-row gap-3">
                    <DatePopoverField
                      label="New date"
                      value={decideNewDate}
                      onChange={setDecideNewDate}
                      className="flex-1"
                    />
                    <TimePopoverField
                      label="New time"
                      value={decideNewTime}
                      onChange={setDecideNewTime}
                      className="flex-1"
                    />
                  </View>
                </View>
              ) : null}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={deciding}
                  onPress={() => void decide('decline')}>
                  <Text>Decline</Text>
                </Button>
                <Button
                  variant="ghost"
                  disabled={deciding}
                  onPress={() =>
                    decideWithRescheduleOpen
                      ? void decide('approve_with_reschedule')
                      : setDecideWithRescheduleOpen(true)
                  }>
                  <Text>
                    {decideWithRescheduleOpen
                      ? deciding
                        ? 'Saving…'
                        : 'Save new time'
                      : 'Approve with reschedule'}
                  </Text>
                </Button>
                <Button disabled={deciding} onPress={() => void decide('approve')}>
                  <Text>{deciding ? 'Saving…' : 'Approve'}</Text>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <Input
                value={decideNote}
                onChangeText={setDecideNote}
                placeholder="Note to client (optional)"
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={deciding}
                  onPress={() => void decide('decline')}>
                  <Text>Decline</Text>
                </Button>
                <Button disabled={deciding} onPress={() => void decide('approve')}>
                  <Text>{deciding ? 'Saving…' : 'Approve'}</Text>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Feature 24: conflict resolution — Merge with the existing schedule
          or Cancel the existing schedule so the new time can take it. */}
      <Dialog
        open={conflict !== null}
        onOpenChange={(open) => {
          if (!open) setConflict(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule conflict</DialogTitle>
            <DialogDescription>
              The proposed time overlaps an existing schedule.
            </DialogDescription>
          </DialogHeader>
          <View className="gap-2">
            {conflict?.conflicts.map((c) => (
              <View
                key={`${c.kind}-${c.id}`}
                className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {c.kind === 'session'
                    ? c.client_name
                    : `${c.client_name} (reschedule request)`}
                </Text>
                <Text variant="muted" className="text-xs">
                  {dayLabel(c.date)} · {clockTime(c.time)}
                </Text>
              </View>
            ))}
          </View>
          <DialogFooter>
            <Button variant="ghost" onPress={() => setConflict(null)}>
              <Text>Pick another time</Text>
            </Button>
            <Button
              variant="outline"
              disabled={conflictBusy}
              onPress={() => void resolveConflictMerge()}>
              <Text>{conflictBusy ? 'Saving…' : 'Merge with existing'}</Text>
            </Button>
            <Button
              variant="destructive"
              disabled={conflictBusy}
              onPress={() => void resolveConflictCancelExisting()}>
              <Text>Cancel existing</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
