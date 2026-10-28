import { useRouter } from 'expo-router';
import { ChevronRightIcon, PlusIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Badge, EmptyView, ErrorView, LoadingView, Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SwipeRail } from '@/components/swipe-rail';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import type { Client, DietPlan, Paginated, WorkoutPlan } from '@/lib/types';

type Segment = 'workout' | 'diet';
type Option = { value: string; label: string };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function PlanRow({
  name,
  clientName,
  isTemplate,
  meta,
  onPress,
}: {
  name: string;
  clientName: string | null;
  isTemplate: boolean;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm shadow-black/[0.05] active:opacity-70 dark:shadow-black/30">
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-medium" numberOfLines={1}>
            {name}
          </Text>
          {isTemplate ? <Badge label="Template" tone="info" /> : null}
        </View>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {isTemplate ? 'Template' : clientName ?? 'Unassigned'}
        </Text>
      </View>
      <Text variant="muted" className="text-xs">
        {meta}
      </Text>
      <Icon as={ChevronRightIcon} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}

export default function PlansScreen() {
  const router = useRouter();
  const [segment, setSegment] = React.useState<Segment>('workout');
  const [lit, setLit] = React.useState<0 | 1>(0);
  const [filter, setFilter] = React.useState<Option>({ value: 'all', label: 'All plans' });
  const [clients, setClients] = React.useState<Client[]>([]);
  const [workoutPlans, setWorkoutPlans] = React.useState<WorkoutPlan[]>([]);
  const [dietPlans, setDietPlans] = React.useState<DietPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(
    async (initial?: boolean) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const clientFilter = filter.value === 'all' ? undefined : filter.value;
        const [workout, diet] = await Promise.all([
          api<Paginated<WorkoutPlan>>('workout-plans/', { query: { client: clientFilter } }),
          api<Paginated<DietPlan>>('diet-plans/', { query: { client: clientFilter } }),
        ]);
        setWorkoutPlans(workout.results);
        setDietPlans(diet.results);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load plans.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  React.useEffect(() => {
    void load(true);
  }, [load]);

  React.useEffect(() => {
    api<Paginated<Client>>('clients/', { query: { page_size: 200 } })
      .then((res) => setClients(res.results))
      .catch(() => setClients([]));
  }, []);

  async function onCreate() {
    setCreating(true);
    try {
      const path = segment === 'workout' ? 'workout-plans/' : 'diet-plans/';
      const plan = await api<{ id: number }>(path, {
        method: 'POST',
        body: {
          name: newName.trim() || 'Untitled plan',
          description: newDesc.trim(),
          // Empty collections — the API treats these as optional but rejects
          // requests where the key is missing entirely.
          ...(segment === 'workout' ? { days: [] } : { meals: [] }),
        },
      });
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      router.push(segment === 'workout' ? `/plan/workout/${plan.id}` : `/plan/diet/${plan.id}`);
    } catch (e) {
      Alert.alert('Could not create plan', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  }

  function openCreate() {
    setNewName('');
    setNewDesc('');
    setCreateOpen(true);
  }

  const filterItems: Option[] = [
    { value: 'all', label: 'All plans' },
    ...clients.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const createTitle = segment === 'workout' ? 'workout' : 'diet';

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading plans…" />
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

  const body = (
    <>
      {segment === 'workout' ? (
        <View className="gap-3">
          {workoutPlans.length === 0 ? (
            <EmptyView
              title="No workout plans"
              subtitle={
                filter.value === 'all'
                  ? 'Create your first workout plan.'
                  : 'Nothing matches this filter.'
              }
              action={
                <Button onPress={openCreate}>
                  <Text>New workout plan</Text>
                </Button>
              }
            />
          ) : (
            workoutPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                name={plan.name}
                clientName={plan.client_name}
                isTemplate={plan.is_template}
                meta={plural(plan.days.length, 'day')}
                onPress={() => router.push(`/plan/workout/${plan.id}`)}
              />
            ))
          )}
        </View>
      ) : (
        <View className="gap-3">
          {dietPlans.length === 0 ? (
            <EmptyView
              title="No diet plans"
              subtitle={
                filter.value === 'all' ? 'Create your first diet plan.' : 'Nothing matches this filter.'
              }
              action={
                <Button onPress={openCreate}>
                  <Text>New diet plan</Text>
                </Button>
              }
            />
          ) : (
            dietPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                name={plan.name}
                clientName={plan.client_name}
                isTemplate={plan.is_template}
                meta={plural(plan.meals.length, 'meal')}
                onPress={() => router.push(`/plan/diet/${plan.id}`)}
              />
            ))
          )}
        </View>
      )}
    </>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={() => void load()}>
      <View className="mb-5 mt-5 flex-row items-center justify-between gap-2">
        <Combobox
          value={filter.value}
          onValueChange={(value) =>
            setFilter(filterItems.find((item) => item.value === value) ?? filterItems[0])
          }
          options={filterItems}
          placeholder="All plans"
          searchPlaceholder="Search plans or clients…"
          align="left"
          className="w-48"
        />
        <Button size="sm" onPress={openCreate} className="px-5">
          <Icon as={PlusIcon} size={16} />
          <Text>New</Text>
        </Button>
      </View>

      <View className="mb-[5px] flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="h2">{segment === 'workout' ? 'Workouts' : 'Diet'}</Text>
          <Text variant="muted" className="text-xs">
            {segment === 'workout'
              ? plural(workoutPlans.length, 'workout plan')
              : plural(dietPlans.length, 'diet plan')}
          </Text>
        </View>
        <SwipeRail
          direction={segment === 'workout' ? 'forward' : 'back'}
          label={segment === 'workout' ? 'Swipe to Diet' : 'Swipe to Workout'}
          lit={lit}
          onLitChange={setLit}
          onPress={() => setSegment((s) => (s === 'workout' ? 'diet' : 'workout'))}
        />
      </View>

      {body}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New {createTitle} plan</DialogTitle>
            <DialogDescription>Give the plan a name. You can edit it later.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Plan name"
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="words"
          />
          <View className="gap-1.5">
            <Text variant="muted" className="text-xs font-medium">
              Description (optional)
            </Text>
            <Textarea
              placeholder="What is this plan about? Goals, focus, notes…"
              value={newDesc}
              onChangeText={setNewDesc}
            />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setCreateOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button disabled={creating} onPress={() => void onCreate()}>
              <Text>{creating ? 'Creating…' : 'Create'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
