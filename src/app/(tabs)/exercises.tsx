import { PlusIcon, Trash2Icon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import {
  Badge,
  EmptyView,
  ErrorView,
  LoadingView,
  Screen,
  ScreenHeader,
} from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { Exercise, Paginated } from '@/lib/types';

type Option = { value: string; label: string };

const TYPE_OPTIONS: Option[] = [
  { value: 'all', label: 'All types' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'core', label: 'Core' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'plyometrics', label: 'Plyometrics' },
  { value: 'other', label: 'Other' },
];

const GROUP_OPTIONS: Option[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
].map((g) => ({ value: g, label: g }));

const DIFFICULTY_OPTIONS: Option[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const TYPE_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  strength: 'info',
  cardio: 'warning',
  core: 'success',
  flexibility: 'success',
  mobility: 'info',
  plyometrics: 'warning',
  other: 'default',
};

const TYPE_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  core: 'Core',
  flexibility: 'Flexibility',
  mobility: 'Mobility',
  plyometrics: 'Plyometrics',
  other: 'Other',
};

type Draft = {
  name: string;
  exercise_type: string;
  muscle_group: string;
  difficulty: string;
  equipment: string;
  description: string;
  sets: string;
  reps: string;
  rest_seconds: string;
  duration_minutes: string;
  video_url: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  exercise_type: 'strength',
  muscle_group: 'Chest',
  difficulty: 'beginner',
  equipment: '',
  description: '',
  sets: '3',
  reps: '10-12',
  rest_seconds: '60',
  duration_minutes: '',
  video_url: '',
};

function toDraft(exercise: Exercise): Draft {
  return {
    name: exercise.name,
    exercise_type: exercise.exercise_type || 'strength',
    muscle_group: exercise.muscle_group || 'Chest',
    difficulty: exercise.difficulty || 'beginner',
    equipment: exercise.equipment,
    description: exercise.description,
    sets: String(exercise.sets),
    reps: exercise.reps,
    rest_seconds: String(exercise.rest_seconds),
    duration_minutes:
      exercise.duration_minutes == null ? '' : String(exercise.duration_minutes),
    video_url: exercise.video_url,
  };
}

function toInt(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toPayload(draft: Draft) {
  return {
    name: draft.name.trim() || 'Untitled exercise',
    exercise_type: draft.exercise_type,
    muscle_group: draft.muscle_group,
    difficulty: draft.difficulty,
    equipment: draft.equipment.trim(),
    description: draft.description.trim(),
    sets: toInt(draft.sets, 3),
    reps: draft.reps.trim() || '10',
    rest_seconds: toInt(draft.rest_seconds, 60),
    duration_minutes: draft.duration_minutes.trim()
      ? toInt(draft.duration_minutes, 0)
      : null,
    video_url: draft.video_url.trim(),
  };
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text variant="muted" className="text-xs font-medium">
        {label}
      </Text>
      {children}
    </View>
  );
}

function errorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'body' in e) {
    const body = (e as { body?: unknown }).body;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object') {
      const first = Object.values(body as Record<string, unknown>)[0];
      if (Array.isArray(first) && first.length) return String(first[0]);
      if (typeof first === 'string') return first;
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export default function ExercisesScreen() {
  const [items, setItems] = React.useState<Exercise[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');

  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [dirty, setDirty] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const load = React.useCallback(
    async (initial?: boolean) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await api<Paginated<Exercise>>('exercises/', {
          query: {
            search: search.trim() || undefined,
            type: typeFilter !== 'all' ? typeFilter : undefined,
            page_size: 200,
          },
        });
        setItems(res.results);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, typeFilter]
  );

  const firstRun = React.useRef(true);
  React.useEffect(() => {
    const timer = setTimeout(() => void load(firstRun.current), 250);
    firstRun.current = false;
    return () => clearTimeout(timer);
  }, [load]);

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  // Autosave: every edit to a saved exercise persists shortly after typing,
  // with a small Saving… / Saved indicator in the dialog.
  React.useEffect(() => {
    if (editingId == null || !dirty) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        const updated = await api<Exercise>(`exercises/${editingId}/`, {
          method: 'PATCH',
          body: toPayload(draft),
        });
        setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
        setDirty(false);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [dirty, draft, editingId]);

  async function flush() {
    if (editingId == null || !dirty) return;
    try {
      const updated = await api<Exercise>(`exercises/${editingId}/`, {
        method: 'PATCH',
        body: toPayload(draft),
      });
      setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      setDirty(false);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  function newExercise() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDirty(false);
    setSaveState('idle');
    setOpen(true);
  }

  function openEdit(exercise: Exercise) {
    if (exercise.trainer == null) {
      Alert.alert(
        'Shared exercise',
        'This exercise comes from the shared base library. You can add it to your plans, but only the owner can edit it.'
      );
      return;
    }
    setEditingId(exercise.id);
    setDraft(toDraft(exercise));
    setDirty(false);
    setSaveState('idle');
    setOpen(true);
  }

  async function closeDialog() {
    await flush();
    setOpen(false);
  }

  async function create() {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Give the exercise a name first.');
      return;
    }
    setCreating(true);
    try {
      const created = await api<Exercise>('exercises/', {
        method: 'POST',
        body: toPayload(draft),
      });
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setOpen(false);
    } catch (e) {
      Alert.alert('Could not create exercise', errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  function confirmDelete(exercise: Exercise) {
    Alert.alert('Delete exercise?', `“${exercise.name}” will be removed from your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`exercises/${exercise.id}/`, { method: 'DELETE' });
            setItems((prev) => prev.filter((i) => i.id !== exercise.id));
            if (editingId === exercise.id) setOpen(false);
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading exercises…" />
      </Screen>
    );
  }

  if (error && items.length === 0) {
    return (
      <Screen scroll={false}>
        <ErrorView error={error} onRetry={() => void load(true)} />
      </Screen>
    );
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? '✓ Saved'
        : saveState === 'error'
          ? 'Could not save — retrying on next change'
          : '';

  return (
    <Screen refreshing={refreshing} onRefresh={() => void load()}>
      <View className="mb-5 mt-5 flex-row items-center justify-between gap-2">
        <Input
          placeholder="Search exercises…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1"
        />
        <Combobox
          value={typeFilter}
          onValueChange={setTypeFilter}
          options={TYPE_OPTIONS}
          placeholder="All types"
          searchPlaceholder="Search types…"
          align="right"
          className="w-40"
        />
      </View>

      <ScreenHeader
        title="Exercises"
        subtitle={`${items.length} in your library`}
        right={
          <Button size="sm" onPress={newExercise} className="px-5">
            <Icon as={PlusIcon} size={16} />
            <Text>New</Text>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyView
          title="No exercises"
          subtitle={
            search || typeFilter !== 'all'
              ? 'Nothing matches your search.'
              : 'Build your exercise library — it feeds the “Add exercise” picker inside every workout plan.'
          }
          action={
            <Button onPress={newExercise}>
              <Text>New exercise</Text>
            </Button>
          }
        />
      ) : (
        <View className="gap-3">
          {items.map((exercise) => (
            <Pressable
              key={exercise.id}
              onPress={() => openEdit(exercise)}
              className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm shadow-black/[0.05] active:opacity-70 dark:shadow-black/30">
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="font-medium" numberOfLines={1}>
                    {exercise.name}
                  </Text>
                  <Badge
                    label={TYPE_LABEL[exercise.exercise_type] ?? 'Strength'}
                    tone={TYPE_TONE[exercise.exercise_type] ?? 'info'}
                  />
                  {exercise.trainer == null ? (
                    <Badge label="Base" tone="default" />
                  ) : null}
                </View>
                <Text variant="muted" className="text-xs">
                  {[exercise.muscle_group, exercise.difficulty, exercise.equipment]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </Text>
              </View>
              <Text variant="muted" className="text-xs">
                {exercise.sets}×{exercise.reps}
              </Text>
              {exercise.trainer != null ? (
                <Pressable
                  onPress={() => confirmDelete(exercise)}
                  hitSlop={10}
                  className="rounded-lg p-2 active:bg-accent">
                  <Icon as={Trash2Icon} size={16} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else void closeDialog();
        }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId == null ? 'New exercise' : 'Edit exercise'}</DialogTitle>
            <DialogDescription>
              {editingId == null
                ? 'It will appear in every plan’s “Add exercise” picker.'
                : 'Changes save automatically as you type.'}
            </DialogDescription>
          </DialogHeader>

          <ScrollView
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}>
            <Labeled label="Name">
              <Input
                placeholder="e.g. Barbell Bench Press"
                value={draft.name}
                onChangeText={(v) => patch('name', v)}
                autoCapitalize="words"
              />
            </Labeled>

            <Labeled label="Type">
              <Combobox
                value={draft.exercise_type}
                onValueChange={(v) => patch('exercise_type', v)}
                options={TYPE_OPTIONS.filter((o) => o.value !== 'all')}
                placeholder="Type"
                align="left"
                className="w-full"
              />
            </Labeled>

            <Labeled label="Muscle group">
              <Combobox
                value={draft.muscle_group}
                onValueChange={(v) => patch('muscle_group', v)}
                options={GROUP_OPTIONS}
                placeholder="Group"
                align="left"
                className="w-full"
              />
            </Labeled>

            <Labeled label="Difficulty">
              <Combobox
                value={draft.difficulty}
                onValueChange={(v) => patch('difficulty', v)}
                options={DIFFICULTY_OPTIONS}
                placeholder="Difficulty"
                align="left"
                className="w-full"
              />
            </Labeled>

            <Labeled label="Description (optional)">
              <Textarea
                placeholder="Form cues, tempo, how to perform it…"
                value={draft.description}
                onChangeText={(v) => patch('description', v)}
              />
            </Labeled>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Labeled label="Sets">
                  <Input
                    value={draft.sets}
                    onChangeText={(v) => patch('sets', v)}
                    keyboardType="number-pad"
                    placeholder="3"
                  />
                </Labeled>
              </View>
              <View className="flex-1">
                <Labeled label="Reps">
                  <Input
                    value={draft.reps}
                    onChangeText={(v) => patch('reps', v)}
                    placeholder="10-12"
                  />
                </Labeled>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Labeled label="Rest (sec)">
                  <Input
                    value={draft.rest_seconds}
                    onChangeText={(v) => patch('rest_seconds', v)}
                    keyboardType="number-pad"
                    placeholder="60"
                  />
                </Labeled>
              </View>
              <View className="flex-1">
                <Labeled label="Duration (min)">
                  <Input
                    value={draft.duration_minutes}
                    onChangeText={(v) => patch('duration_minutes', v)}
                    keyboardType="number-pad"
                    placeholder="—"
                  />
                </Labeled>
              </View>
            </View>

            <Labeled label="Equipment (optional)">
              <Input
                placeholder="Barbell, dumbbell, machine…"
                value={draft.equipment}
                onChangeText={(v) => patch('equipment', v)}
                autoCapitalize="words"
              />
            </Labeled>

            <Labeled label="Demo video link (optional)">
              <Input
                placeholder="https://…"
                value={draft.video_url}
                onChangeText={(v) => patch('video_url', v)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </Labeled>
          </ScrollView>

          {editingId != null && saveLabel ? (
            <Text
              className={
                saveState === 'error'
                  ? 'text-xs text-destructive'
                  : 'text-xs text-muted-foreground'
              }>
              {saveLabel}
            </Text>
          ) : null}

          <DialogFooter>
            {editingId == null ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => void closeDialog()}>
                  <Text>Cancel</Text>
                </Button>
                <Button
                  className="flex-1"
                  disabled={creating}
                  onPress={() => void create()}>
                  <Text>{creating ? 'Creating…' : 'Create'}</Text>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onPress={() => {
                    const ex = items.find((i) => i.id === editingId);
                    if (ex) confirmDelete(ex);
                  }}>
                  <Text>Delete</Text>
                </Button>
                <Button className="flex-1" onPress={() => void closeDialog()}>
                  <Text>Done</Text>
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
