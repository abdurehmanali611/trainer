import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { Badge, ErrorView, LoadingView, Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
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
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Exercise, Paginated, WorkoutDay, WorkoutPlan } from '@/lib/types';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

type ConfigState = {
  dayIndex: number;
  exerciseIndex: number | null;
  exerciseId: number;
  detail: Exercise;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
};

function toInt(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fallbackDetail(exerciseId: number, sets: number, reps: string, rest: number): Exercise {
  return {
    id: exerciseId,
    name: `Exercise #${exerciseId}`,
    exercise_type: 'strength',
    muscle_group: '',
    difficulty: '',
    equipment: '',
    description: '',
    sets,
    reps,
    rest_seconds: rest,
    duration_minutes: null,
    video_url: '',
    trainer: null,
  };
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <View className="flex-1 gap-1.5">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Input {...props} />
    </View>
  );
}

export default function WorkoutPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const path = `workout-plans/${id}/`;

  const [plan, setPlan] = React.useState<WorkoutPlan | null>(null);
  const [name, setName] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [addDayOpen, setAddDayOpen] = React.useState(false);
  const [dayName, setDayName] = React.useState('');

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerDayIndex, setPickerDayIndex] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [group, setGroup] = React.useState('All');
  const [results, setResults] = React.useState<Exercise[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerError, setPickerError] = React.useState<string | null>(null);

  const [config, setConfig] = React.useState<ConfigState | null>(null);

  const load = React.useCallback(
    async (initial?: boolean) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const data = await api<WorkoutPlan>(path);
        setPlan(data);
        setName(data.name);
        setDirty(false);
        setSaveError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the plan.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [path]
  );

  React.useEffect(() => {
    void load(true);
  }, [load]);

  React.useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setPickerLoading(true);
        setPickerError(null);
        try {
          const res = await api<Paginated<Exercise>>('exercises/', {
            query: {
              search: search.trim() || undefined,
              group: group === 'All' ? undefined : group,
            },
          });
          if (!cancelled) setResults(res.results);
        } catch (e) {
          if (!cancelled) setPickerError(e instanceof Error ? e.message : 'Search failed.');
        } finally {
          if (!cancelled) setPickerLoading(false);
        }
      },
      search.trim() ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerOpen, search, group]);

  function updateDays(updater: (days: WorkoutDay[]) => WorkoutDay[]) {
    setPlan((prev) => (prev ? { ...prev, days: updater(prev.days) } : prev));
    setDirty(true);
    setSaveError(null);
  }

  // Autosave: persist the plan shortly after the last change — adding a day,
  // adding/editing/removing an exercise, or renaming — instead of requiring
  // an explicit Save press.
  React.useEffect(() => {
    if (!dirty || saving || saveError) return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [dirty, saving, saveError, save]);

  async function save() {
    if (!plan) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: name.trim() || 'Untitled plan',
        client: plan.client,
        days: plan.days.map((day, i) => ({
          day_name: day.day_name,
          order: i,
          exercises: day.exercises.map((ex, j) => ({
            exercise: ex.exercise,
            sets: ex.sets,
            reps: ex.reps,
            target_weight: ex.target_weight,
            rest_seconds: ex.rest_seconds,
            order: j,
          })),
        })),
      };
      const updated = await api<WorkoutPlan>(path, { method: 'PATCH', body: payload });
      setPlan(updated);
      setName(updated.name);
      setDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  }

  function addDay() {
    updateDays((days) => [
      ...days,
      { day_name: dayName.trim() || `Day ${days.length + 1}`, order: days.length, exercises: [] },
    ]);
    setAddDayOpen(false);
    setDayName('');
  }

  function deleteDay(dayIndex: number) {
    const day = plan?.days[dayIndex];
    if (!day) return;
    Alert.alert('Delete day?', `"${day.day_name}" and its exercises will be removed on save.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => updateDays((days) => days.filter((_, i) => i !== dayIndex)),
      },
    ]);
  }

  function moveExercise(dayIndex: number, exerciseIndex: number, dir: -1 | 1) {
    updateDays((days) =>
      days.map((day, i) => {
        if (i !== dayIndex) return day;
        const exercises = [...day.exercises];
        const target = exerciseIndex + dir;
        if (target < 0 || target >= exercises.length) return day;
        [exercises[exerciseIndex], exercises[target]] = [exercises[target], exercises[exerciseIndex]];
        return { ...day, exercises };
      })
    );
  }

  function removeExercise(dayIndex: number, exerciseIndex: number) {
    updateDays((days) =>
      days.map((day, i) =>
        i === dayIndex
          ? { ...day, exercises: day.exercises.filter((_, j) => j !== exerciseIndex) }
          : day
      )
    );
  }

  function openPicker(dayIndex: number) {
    setPickerDayIndex(dayIndex);
    setSearch('');
    setGroup('All');
    setResults([]);
    setPickerOpen(true);
  }

  function pickExercise(exercise: Exercise) {
    setPickerOpen(false);
    setConfig({
      dayIndex: pickerDayIndex,
      exerciseIndex: null,
      exerciseId: exercise.id,
      detail: exercise,
      sets: String(exercise.sets),
      reps: exercise.reps,
      weight: '',
      rest: String(exercise.rest_seconds),
    });
  }

  function editExercise(dayIndex: number, exerciseIndex: number) {
    const ex = plan?.days[dayIndex]?.exercises[exerciseIndex];
    if (!ex) return;
    setConfig({
      dayIndex,
      exerciseIndex,
      exerciseId: ex.exercise,
      detail:
        ex.exercise_detail ??
        fallbackDetail(ex.exercise, ex.sets, ex.reps, ex.rest_seconds),
      sets: String(ex.sets),
      reps: ex.reps,
      weight: ex.target_weight ? String(ex.target_weight) : '',
      rest: String(ex.rest_seconds),
    });
  }

  function applyConfig() {
    if (!config) return;
    const values = {
      exercise: config.exerciseId,
      exercise_detail: config.detail,
      sets: Math.max(1, toInt(config.sets, 3)),
      reps: config.reps.trim() || '10',
      target_weight: Math.max(0, toNumber(config.weight, 0)),
      rest_seconds: Math.max(1, toInt(config.rest, 60)),
    };
    updateDays((days) =>
      days.map((day, i) => {
        if (i !== config.dayIndex) return day;
        const exercises = [...day.exercises];
        if (config.exerciseIndex === null) {
          exercises.push({ ...values, order: exercises.length });
        } else {
          const existing = exercises[config.exerciseIndex];
          exercises[config.exerciseIndex] = {
            ...existing,
            ...values,
            order: config.exerciseIndex,
          };
        }
        return { ...day, exercises };
      })
    );
    setConfig(null);
  }

  async function saveAsTemplate() {
    if (!plan) return;
    try {
      const updated = await api<WorkoutPlan>(path, { method: 'PATCH', body: { client: null } });
      setPlan(updated);
      setName(updated.name);
      setDirty(false);
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function confirmDeletePlan() {
    Alert.alert('Delete plan?', 'This permanently removes the plan and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(path, { method: 'DELETE' });
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Workout plan' }} />
        <Screen scroll={false}>
          <LoadingView label="Loading plan…" />
        </Screen>
      </>
    );
  }

  if (error || !plan) {
    return (
      <>
        <Stack.Screen options={{ title: 'Workout plan' }} />
        <Screen scroll={false}>
          <ErrorView error={error ?? 'Plan not found.'} onRetry={() => void load(true)} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: name || 'Workout plan' }} />
      <Screen refreshing={refreshing} onRefresh={() => void load()}>
        <View className="gap-6">
          <View className="gap-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge label={plan.is_template ? 'Template' : 'Assigned'} tone={plan.is_template ? 'info' : 'success'} />
              {!plan.is_template && plan.client_name ? (
                <Text variant="muted">{plan.client_name}</Text>
              ) : null}
            </View>
            <Input
              placeholder="Plan name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setDirty(true);
              }}
              autoCapitalize="words"
            />
            <View className="flex-row flex-wrap gap-2">
              {!plan.is_template ? (
                <Button variant="outline" size="sm" onPress={() => void saveAsTemplate()}>
                  <Text>Save as template</Text>
                </Button>
              ) : null}
              <Button variant="destructive" size="sm" onPress={confirmDeletePlan}>
                <Icon as={Trash2Icon} size={16} />
                <Text>Delete</Text>
              </Button>
            </View>
          </View>

          <View className="gap-1.5">
            {saveError ? (
              <Text
                className="text-sm text-destructive underline"
                onPress={() => {
                  setSaveError(null);
                  void save();
                }}>
                Autosave failed — tap to retry
              </Text>
            ) : (
              <Text variant="muted">{saving ? 'Saving…' : 'All changes saved'}</Text>
            )}
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text variant="h4">Days</Text>
              <Button variant="outline" size="sm" onPress={() => { setDayName(''); setAddDayOpen(true); }}>
                <Icon as={PlusIcon} size={16} />
                <Text>Add day</Text>
              </Button>
            </View>

            {plan.days.length === 0 ? (
              <Text variant="muted">No days yet. Add a day to start building the plan.</Text>
            ) : (
              plan.days.map((day, dayIndex) => (
                <View key={`day-${dayIndex}`} className="gap-3 rounded-xl border border-border bg-card p-4">
                  <View className="flex-row items-center gap-2">
                    <Input
                      className="flex-1"
                      value={day.day_name}
                      onChangeText={(v) =>
                        updateDays((days) =>
                          days.map((d, i) => (i === dayIndex ? { ...d, day_name: v } : d))
                        )
                      }
                      autoCapitalize="words"
                    />
                    <Pressable hitSlop={8} onPress={() => deleteDay(dayIndex)}>
                      <Icon as={Trash2Icon} size={18} className="text-destructive" />
                    </Pressable>
                  </View>

                  {day.exercises.length === 0 ? (
                    <Text variant="muted" className="text-sm">
                      No exercises yet.
                    </Text>
                  ) : (
                    day.exercises.map((ex, exIndex) => (
                      <View
                        key={`ex-${dayIndex}-${exIndex}`}
                        className="flex-row items-center gap-2 rounded-lg border border-border bg-background p-2.5">
                        <View className="gap-1">
                          <Pressable
                            hitSlop={6}
                            disabled={exIndex === 0}
                            onPress={() => moveExercise(dayIndex, exIndex, -1)}
                            className={cn(exIndex === 0 && 'opacity-30')}>
                            <Icon as={ArrowUpIcon} size={16} />
                          </Pressable>
                          <Pressable
                            hitSlop={6}
                            disabled={exIndex === day.exercises.length - 1}
                            onPress={() => moveExercise(dayIndex, exIndex, 1)}
                            className={cn(exIndex === day.exercises.length - 1 && 'opacity-30')}>
                            <Icon as={ArrowDownIcon} size={16} />
                          </Pressable>
                        </View>
                        <View className="min-w-0 flex-1 gap-0.5">
                          <Text className="text-sm font-medium" numberOfLines={1}>
                            {ex.exercise_detail?.name ?? `Exercise #${ex.exercise}`}
                          </Text>
                          <Text variant="muted" className="text-xs" numberOfLines={1}>
                            {[
                              ex.exercise_detail?.muscle_group,
                              `${ex.sets} × ${ex.reps}`,
                              `${ex.rest_seconds}s rest`,
                              ex.target_weight ? `${ex.target_weight}kg` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        <Pressable hitSlop={6} onPress={() => editExercise(dayIndex, exIndex)}>
                          <Icon as={PencilIcon} size={16} className="text-muted-foreground" />
                        </Pressable>
                        <Pressable hitSlop={6} onPress={() => removeExercise(dayIndex, exIndex)}>
                          <Icon as={Trash2Icon} size={16} className="text-destructive" />
                        </Pressable>
                      </View>
                    ))
                  )}

                  <Button variant="outline" size="sm" onPress={() => openPicker(dayIndex)}>
                    <Icon as={PlusIcon} size={16} />
                    <Text>Add exercise</Text>
                  </Button>
                </View>
              ))
            )}
          </View>
        </View>
      </Screen>

      <Dialog open={addDayOpen} onOpenChange={setAddDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add day</DialogTitle>
            <DialogDescription>{'Name the training day, e.g. "Push" or "Day 1".'}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Day name"
            value={dayName}
            onChangeText={setDayName}
            autoCapitalize="words"
          />
          <DialogFooter>
            <Button variant="outline" onPress={() => setAddDayOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={addDay}>
              <Text>Add day</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add exercise</DialogTitle>
            <DialogDescription>Search the exercise library or browse by muscle group.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search exercises"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2">
            {MUSCLE_GROUPS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGroup(g)}
                className={cn(
                  'rounded-full border px-3 py-1.5',
                  group === g ? 'border-primary bg-primary' : 'border-border bg-background'
                )}>
                <Text
                  className={cn('text-xs font-medium', group === g ? 'text-primary-foreground' : 'text-foreground')}>
                  {g}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView className="max-h-72" keyboardShouldPersistTaps="handled">
            {pickerLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator />
              </View>
            ) : pickerError ? (
              <Text className="text-destructive text-sm">{pickerError}</Text>
            ) : results.length === 0 ? (
              <Text variant="muted">No exercises found.</Text>
            ) : (
              <View className="gap-2">
                {results.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    onPress={() => pickExercise(exercise)}
                    className="flex-row items-center gap-3 rounded-lg border border-border p-3 active:bg-accent">
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {exercise.name}
                      </Text>
                      <Text variant="muted" className="text-xs">
                        {[exercise.muscle_group, exercise.difficulty].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Icon as={PlusIcon} size={16} className="text-muted-foreground" />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>

      <Dialog
        open={config !== null}
        onOpenChange={(open) => {
          if (!open) setConfig(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{config?.exerciseIndex === null ? 'Add exercise' : 'Edit exercise'}</DialogTitle>
            <DialogDescription>{config?.detail.name}</DialogDescription>
          </DialogHeader>
          {config ? (
            <View className="gap-4">
              <View className="flex-row gap-3">
                <Field
                  label="Sets"
                  value={config.sets}
                  onChangeText={(v) => setConfig({ ...config, sets: v })}
                  keyboardType="number-pad"
                />
                <Field
                  label="Rest (seconds)"
                  value={config.rest}
                  onChangeText={(v) => setConfig({ ...config, rest: v })}
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-row gap-3">
                <Field
                  label="Reps"
                  value={config.reps}
                  onChangeText={(v) => setConfig({ ...config, reps: v })}
                />
                <Field
                  label="Target weight (kg)"
                  value={config.weight}
                  onChangeText={(v) => setConfig({ ...config, weight: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setConfig(null)}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={applyConfig}>
              <Text>{config?.exerciseIndex === null ? 'Add' : 'Save'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
