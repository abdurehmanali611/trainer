import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  ClockIcon,
  CloudUploadIcon,
  FlameIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UtensilsIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Gradient, sunriseGradient } from '@/components/gradient';
import { alpha, Chip, COLORS, IconBubble, Panel, SectionHeader } from '@/components/kit';
import { Badge, ErrorView, LoadingView, Screen } from '@/components/screen';
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
import { TimeField } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { clockTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { DietPlan, Meal } from '@/lib/types';

type FormState = {
  name: string;
  dailyCalories: string;
  protein: string;
  carbs: string;
  fats: string;
};

type ItemConfig = {
  mealIndex: number;
  itemIndex: number | null;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
};

function toInt(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positive(value: string, fallback: number): number {
  return Math.max(1, toInt(value, fallback));
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

export default function DietPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const path = `diet-plans/${id}/`;

  const [plan, setPlan] = React.useState<DietPlan | null>(null);
  const [form, setForm] = React.useState<FormState>({
    name: '',
    dailyCalories: '',
    protein: '',
    carbs: '',
    fats: '',
  });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [addMealOpen, setAddMealOpen] = React.useState(false);
  const [mealDraft, setMealDraft] = React.useState({ name: '', time: '' });

  const [itemConfig, setItemConfig] = React.useState<ItemConfig | null>(null);
  const [mealTimeEdit, setMealTimeEdit] = React.useState<{ mealIndex: number; time: string } | null>(
    null
  );

  const load = React.useCallback(
    async (initial?: boolean) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const data = await api<DietPlan>(path);
        setPlan(data);
        setForm({
          name: data.name,
          dailyCalories: String(data.daily_calories),
          protein: String(data.protein),
          carbs: String(data.carbs),
          fats: String(data.fats),
        });
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

  function updateMeals(updater: (meals: Meal[]) => Meal[]) {
    setPlan((prev) => (prev ? { ...prev, meals: updater(prev.meals) } : prev));
    setDirty(true);
    setSaveError(null);
  }

  function updateForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaveError(null);
  }

  // Autosave: persist the plan shortly after the last change — adding a meal,
  // adding/editing/removing an item, or editing the header/macros — instead of
  // requiring an explicit Save press.
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
        name: form.name.trim() || 'Untitled plan',
        client: plan.client,
        daily_calories: positive(form.dailyCalories, 2000),
        protein: positive(form.protein, 150),
        carbs: positive(form.carbs, 200),
        fats: positive(form.fats, 60),
        meals: plan.meals.map((meal, i) => ({
          name: meal.name,
          time: meal.time,
          order: i,
          items: meal.items.map((item, j) => ({
            name: item.name,
            calories: Math.max(0, toInt(item.calories ? String(item.calories) : '', 0)),
            protein: Math.max(0, toInt(item.protein ? String(item.protein) : '', 0)),
            carbs: Math.max(0, toInt(item.carbs ? String(item.carbs) : '', 0)),
            fats: Math.max(0, toInt(item.fats ? String(item.fats) : '', 0)),
            order: j,
          })),
        })),
      };
      const updated = await api<DietPlan>(path, { method: 'PATCH', body: payload });
      setPlan(updated);
      setForm({
        name: updated.name,
        dailyCalories: String(updated.daily_calories),
        protein: String(updated.protein),
        carbs: String(updated.carbs),
        fats: String(updated.fats),
      });
      setDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  }

  function addMeal() {
    updateMeals((meals) => [
      ...meals,
      {
        name: mealDraft.name.trim() || `Meal ${meals.length + 1}`,
        time: mealDraft.time.trim(),
        order: meals.length,
        items: [],
      },
    ]);
    setMealDraft({ name: '', time: '' });
    setAddMealOpen(false);
  }

  function deleteMeal(mealIndex: number) {
    const meal = plan?.meals[mealIndex];
    if (!meal) return;
    Alert.alert('Delete meal?', `"${meal.name}" and its items will be removed on save.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => updateMeals((meals) => meals.filter((_, i) => i !== mealIndex)),
      },
    ]);
  }

  function moveItem(mealIndex: number, itemIndex: number, dir: -1 | 1) {
    updateMeals((meals) =>
      meals.map((meal, i) => {
        if (i !== mealIndex) return meal;
        const items = [...meal.items];
        const target = itemIndex + dir;
        if (target < 0 || target >= items.length) return meal;
        [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
        return { ...meal, items };
      })
    );
  }

  function removeItem(mealIndex: number, itemIndex: number) {
    updateMeals((meals) =>
      meals.map((meal, i) =>
        i === mealIndex ? { ...meal, items: meal.items.filter((_, j) => j !== itemIndex) } : meal
      )
    );
  }

  function addItem(mealIndex: number) {
    setItemConfig({
      mealIndex,
      itemIndex: null,
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
    });
  }

  function editItem(mealIndex: number, itemIndex: number) {
    const item = plan?.meals[mealIndex]?.items[itemIndex];
    if (!item) return;
    setItemConfig({
      mealIndex,
      itemIndex,
      name: item.name,
      calories: String(item.calories),
      protein: String(item.protein),
      carbs: String(item.carbs),
      fats: String(item.fats),
    });
  }

  function applyItem() {
    if (!itemConfig) return;
    const values = {
      name: itemConfig.name.trim(),
      calories: Math.max(0, toInt(itemConfig.calories, 0)),
      protein: Math.max(0, toInt(itemConfig.protein, 0)),
      carbs: Math.max(0, toInt(itemConfig.carbs, 0)),
      fats: Math.max(0, toInt(itemConfig.fats, 0)),
    };
    updateMeals((meals) =>
      meals.map((meal, i) => {
        if (i !== itemConfig.mealIndex) return meal;
        const items = [...meal.items];
        if (itemConfig.itemIndex === null) {
          items.push({ ...values, order: items.length });
        } else {
          const existing = items[itemConfig.itemIndex];
          items[itemConfig.itemIndex] = { ...existing, ...values, order: itemConfig.itemIndex };
        }
        return { ...meal, items };
      })
    );
    setItemConfig(null);
  }

  async function saveAsTemplate() {
    if (!plan) return;
    try {
      const updated = await api<DietPlan>(path, { method: 'PATCH', body: { client: null } });
      setPlan(updated);
      setForm({
        name: updated.name,
        dailyCalories: String(updated.daily_calories),
        protein: String(updated.protein),
        carbs: String(updated.carbs),
        fats: String(updated.fats),
      });
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
        <Stack.Screen options={{ title: 'Diet plan' }} />
        <Screen scroll={false}>
          <LoadingView label="Loading plan…" />
        </Screen>
      </>
    );
  }

  if (error || !plan) {
    return (
      <>
        <Stack.Screen options={{ title: 'Diet plan' }} />
        <Screen scroll={false}>
          <ErrorView error={error ?? 'Plan not found.'} onRetry={() => void load(true)} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: form.name || 'Diet plan' }} />
      <Screen refreshing={refreshing} onRefresh={() => void load()}>
        <View className="gap-6">
          <Gradient colors={sunriseGradient} style={{ borderRadius: 28, overflow: 'hidden' }}>
            <View className="gap-3 p-5">
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="rounded-full bg-black/25 px-3 py-1">
                  <Text className="text-xs font-bold text-white">
                    {plan.is_template ? 'Template' : 'Assigned'}
                  </Text>
                </View>
                {!plan.is_template && plan.client_name ? (
                  <Text className="text-sm font-semibold text-white/90">{plan.client_name}</Text>
                ) : null}
                <View className="ml-auto flex-row items-center gap-1.5">
                  <Icon
                    as={saveError ? CloudUploadIcon : CheckCircle2Icon}
                    size={14}
                    color={saveError ? '#FEE2E2' : 'rgba(255,255,255,0.9)'}
                  />
                  {saveError ? (
                    <Text
                      className="text-xs font-bold text-white underline"
                      onPress={() => {
                        setSaveError(null);
                        void save();
                      }}>
                      Autosave failed — tap to retry
                    </Text>
                  ) : (
                    <Text className="text-xs font-semibold text-white/90">
                      {saving ? 'Saving…' : 'All changes saved'}
                    </Text>
                  )}
                </View>
              </View>
              <Input
                placeholder="Plan name"
                value={form.name}
                onChangeText={(v) => updateForm({ name: v })}
                autoCapitalize="words"
                style={{ backgroundColor: 'rgba(0,0,0,0.28)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}
                placeholderTextColor="rgba(255,255,255,0.65)"
              />
              <View className="flex-row flex-wrap gap-2">
                {!plan.is_template ? (
                  <Pressable
                    onPress={() => void saveAsTemplate()}
                    className="h-10 items-center justify-center rounded-2xl px-4 active:opacity-80"
                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                    <Text className="text-sm font-bold text-white">Save as template</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={confirmDeletePlan}
                  className="h-10 flex-row items-center gap-2 rounded-2xl px-4 active:opacity-80"
                  style={{ backgroundColor: 'rgba(127,29,29,0.85)' }}>
                  <Icon as={Trash2Icon} size={15} color="#fff" />
                  <Text className="text-sm font-bold text-white">Delete</Text>
                </Pressable>
              </View>
            </View>
          </Gradient>

          <Panel tint={COLORS.amber} className="gap-3">
            <View className="flex-row items-center gap-2.5">
              <IconBubble icon={FlameIcon} color={COLORS.amber} size={32} />
              <Text className="text-[15px] font-bold tracking-tight">Daily macros</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Chip label={`${form.dailyCalories || 0} kcal`} color={COLORS.amber} />
              <Chip label={`P ${form.protein || 0}g`} color={COLORS.rose} />
              <Chip label={`C ${form.carbs || 0}g`} color={COLORS.sky} />
              <Chip label={`F ${form.fats || 0}g`} color={COLORS.lime} />
            </View>
            <Field
              label="Calories (kcal)"
              value={form.dailyCalories}
              onChangeText={(v) => updateForm({ dailyCalories: v })}
              keyboardType="number-pad"
            />
            <View className="flex-row gap-3">
              <Field
                label="Protein (g)"
                value={form.protein}
                onChangeText={(v) => updateForm({ protein: v })}
                keyboardType="number-pad"
              />
              <Field
                label="Carbs (g)"
                value={form.carbs}
                onChangeText={(v) => updateForm({ carbs: v })}
                keyboardType="number-pad"
              />
              <Field
                label="Fats (g)"
                value={form.fats}
                onChangeText={(v) => updateForm({ fats: v })}
                keyboardType="number-pad"
              />
            </View>
          </Panel>

          <View className="gap-3">
            <SectionHeader
              title="Meals"
              subtitle={`${plan.meals.length} meal${plan.meals.length === 1 ? '' : 's'}`}
              icon={UtensilsIcon}
              color={COLORS.green}
              actionLabel="Add meal"
              onAction={() => {
                setMealDraft({ name: '', time: '' });
                setAddMealOpen(true);
              }}
            />

            {plan.meals.length === 0 ? (
              <Text variant="muted">No meals yet. Add a meal to start building the plan.</Text>
            ) : (
              plan.meals.map((meal, mealIndex) => (
                <View
                  key={`meal-${mealIndex}`}
                  className="gap-3 rounded-3xl border p-4"
                  style={{ backgroundColor: alpha(COLORS.green, 0.06), borderColor: alpha(COLORS.green, 0.26) }}>
                  <View className="flex-row items-center gap-2">
                    <Input
                      className="flex-1"
                      value={meal.name}
                      onChangeText={(v) =>
                        updateMeals((meals) =>
                          meals.map((m, i) => (i === mealIndex ? { ...m, name: v } : m))
                        )
                      }
                      autoCapitalize="words"
                    />
                    <Pressable
                      onPress={() => setMealTimeEdit({ mealIndex, time: meal.time })}
                      accessibilityRole="button"
                      className="h-11 w-24 flex-row items-center justify-center gap-1.5 rounded-xl border border-input bg-card px-2 active:opacity-70">
                      <Icon as={ClockIcon} size={14} color={COLORS.green} />
                      <Text
                        numberOfLines={1}
                        className={cn('text-xs', meal.time ? 'text-foreground' : 'text-muted-foreground')}>
                        {meal.time ? clockTime(meal.time) : 'Time'}
                      </Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => deleteMeal(mealIndex)}>
                      <Icon as={Trash2Icon} size={18} color={COLORS.rose} />
                    </Pressable>
                  </View>

                  {meal.items.length === 0 ? (
                    <Text variant="muted" className="text-sm">
                      No items yet.
                    </Text>
                  ) : (
                    meal.items.map((item, itemIndex) => (
                      <View
                        key={`item-${mealIndex}-${itemIndex}`}
                        className="flex-row items-center gap-2 rounded-2xl border border-border bg-background p-2.5">
                        <View className="gap-1">
                          <Pressable
                            hitSlop={6}
                            disabled={itemIndex === 0}
                            onPress={() => moveItem(mealIndex, itemIndex, -1)}
                            className={cn(itemIndex === 0 && 'opacity-30')}>
                            <Icon as={ArrowUpIcon} size={16} color={COLORS.muted} />
                          </Pressable>
                          <Pressable
                            hitSlop={6}
                            disabled={itemIndex === meal.items.length - 1}
                            onPress={() => moveItem(mealIndex, itemIndex, 1)}
                            className={cn(itemIndex === meal.items.length - 1 && 'opacity-30')}>
                            <Icon as={ArrowDownIcon} size={16} color={COLORS.muted} />
                          </Pressable>
                        </View>
                        <View className="min-w-0 flex-1 gap-0.5">
                          <Text className="text-sm font-bold" numberOfLines={1}>
                            {item.name || 'Item'}
                          </Text>
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text className="text-xs font-bold" style={{ color: COLORS.amber }}>
                              {item.calories} kcal
                            </Text>
                            <Text className="text-xs font-bold" style={{ color: COLORS.rose }}>
                              P {item.protein}
                            </Text>
                            <Text className="text-xs font-bold" style={{ color: COLORS.sky }}>
                              C {item.carbs}
                            </Text>
                            <Text className="text-xs font-bold" style={{ color: COLORS.lime }}>
                              F {item.fats}
                            </Text>
                          </View>
                        </View>
                        <Pressable hitSlop={6} onPress={() => editItem(mealIndex, itemIndex)}>
                          <Icon as={PencilIcon} size={16} color={COLORS.sky} />
                        </Pressable>
                        <Pressable hitSlop={6} onPress={() => removeItem(mealIndex, itemIndex)}>
                          <Icon as={Trash2Icon} size={16} color={COLORS.rose} />
                        </Pressable>
                      </View>
                    ))
                  )}

                  <Pressable
                    onPress={() => addItem(mealIndex)}
                    accessibilityRole="button"
                    className="h-11 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80"
                    style={{ backgroundColor: alpha(COLORS.green, 0.16), borderWidth: 1, borderColor: alpha(COLORS.green, 0.4) }}>
                    <Icon as={PlusIcon} size={16} color={COLORS.green} />
                    <Text className="text-sm font-black" style={{ color: COLORS.green }}>
                      Add item
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* Feature 26: the client's diet self-reports — read-only. The
              client approves or declines with a reason; the trainer sees the
              status + reason with NO action buttons anywhere. */}
          {plan.adherence_reports && plan.adherence_reports.length > 0 ? (
            <View className="gap-2">
              <Text variant="h4">Client adherence</Text>
              <Text variant="muted" className="text-xs">
                What the client reported — read-only.
              </Text>
              {plan.adherence_reports.map((report) => (
                <View
                  key={report.id}
                  className="gap-1.5 rounded-2xl border border-border bg-card p-3">
                  <View className="flex-row items-center justify-between gap-2">
                    {report.client_name ? (
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {report.client_name}
                      </Text>
                    ) : null}
                    <Badge
                      label={report.status === 'approved' ? 'Approved' : 'Declined'}
                      tone={report.status === 'approved' ? 'success' : 'danger'}
                    />
                  </View>
                  <Text variant="muted" className="text-xs">
                    {report.reason}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Screen>

      <Dialog open={addMealOpen} onOpenChange={setAddMealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add meal</DialogTitle>
            <DialogDescription>Give the meal a name and an optional time.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <DialogSection icon={UtensilsIcon} label="Meal" className="gap-3">
              <Input
                placeholder="Meal name"
                value={mealDraft.name}
                onChangeText={(v) => setMealDraft((d) => ({ ...d, name: v }))}
                autoCapitalize="words"
              />
              <TimeField
                value={mealDraft.time}
                onChange={(time) => setMealDraft((d) => ({ ...d, time }))}
                placeholder="Time (optional)"
                clearable
              />
            </DialogSection>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onPress={() => setAddMealOpen(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={addMeal}>
              <Text>Add meal</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mealTimeEdit !== null}
        onOpenChange={(open) => {
          if (!open) setMealTimeEdit(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meal time</DialogTitle>
            <DialogDescription>
              {mealTimeEdit ? (plan.meals[mealTimeEdit.mealIndex]?.name ?? 'Meal') : ''}
            </DialogDescription>
          </DialogHeader>
          {mealTimeEdit ? (
            <DialogBody>
              <DialogSection icon={ClockIcon} label="Time">
                <TimeField
                  value={mealTimeEdit.time}
                  onChange={(time) => setMealTimeEdit({ ...mealTimeEdit, time })}
                  placeholder="No time set"
                  clearable
                />
              </DialogSection>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setMealTimeEdit(null)}>
              <Text>Cancel</Text>
            </Button>
            <Button
              onPress={() => {
                if (!mealTimeEdit) return;
                const { mealIndex, time } = mealTimeEdit;
                updateMeals((meals) => meals.map((m, i) => (i === mealIndex ? { ...m, time } : m)));
                setMealTimeEdit(null);
              }}>
              <Text>Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={itemConfig !== null}
        onOpenChange={(open) => {
          if (!open) setItemConfig(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemConfig?.itemIndex === null ? 'Add item' : 'Edit item'}</DialogTitle>
            <DialogDescription>Track the nutrition for this food item.</DialogDescription>
          </DialogHeader>
          {itemConfig ? (
            <DialogBody contentContainerClassName="gap-4">
              <DialogSection icon={AppleIcon} label="Nutrition" className="gap-4">
              <Input
                placeholder="Name"
                value={itemConfig.name}
                onChangeText={(v) => setItemConfig({ ...itemConfig, name: v })}
              />
              <View className="flex-row gap-3">
                <Field
                  label="Calories"
                  value={itemConfig.calories}
                  onChangeText={(v) => setItemConfig({ ...itemConfig, calories: v })}
                  keyboardType="number-pad"
                />
                <Field
                  label="Protein (g)"
                  value={itemConfig.protein}
                  onChangeText={(v) => setItemConfig({ ...itemConfig, protein: v })}
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-row gap-3">
                <Field
                  label="Carbs (g)"
                  value={itemConfig.carbs}
                  onChangeText={(v) => setItemConfig({ ...itemConfig, carbs: v })}
                  keyboardType="number-pad"
                />
                <Field
                  label="Fats (g)"
                  value={itemConfig.fats}
                  onChangeText={(v) => setItemConfig({ ...itemConfig, fats: v })}
                  keyboardType="number-pad"
                />
              </View>
              </DialogSection>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setItemConfig(null)}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={applyItem}>
              <Text>{itemConfig?.itemIndex === null ? 'Add' : 'Save'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
