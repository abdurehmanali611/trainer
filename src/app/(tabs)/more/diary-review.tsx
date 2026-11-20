import { Image } from 'expo-image';
import * as React from 'react';
import { Alert, View } from 'react-native';
import { CheckCircle2Icon, ClockIcon, ImageIcon, SendIcon, SparklesIcon, UtensilsIcon } from 'lucide-react-native';

import { alpha, Chip, COLORS, Panel, Segmented } from '@/components/kit';
import { EmptyView, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
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
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/dates';
import type { Client, FoodDiaryEntry, Paginated } from '@/lib/types';

type Filter = 'all' | 'pending' | 'reviewed';
type DiaryRow = FoodDiaryEntry & { clientId: number; clientName: string };

export default function DiaryReviewScreen() {
  const [rows, setRows] = React.useState<DiaryRow[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [filter, setFilter] = React.useState<Filter>('pending');
  const [recClientId, setRecClientId] = React.useState('');
  const [recText, setRecText] = React.useState('');
  const [sendingRec, setSendingRec] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<DiaryRow | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async (initial?: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const clientRes = await api<Paginated<Client>>('clients/', { query: { page_size: 200 } });
      setClients(clientRes.results);
      const perClient = await Promise.all(
        clientRes.results.map(async (client) => {
          try {
            const res = await api<Paginated<FoodDiaryEntry> | FoodDiaryEntry[]>(
              `clients/${client.id}/food-diary/`
            );
            const entries = Array.isArray(res) ? res : res.results;
            return entries.map((entry) => ({
              ...entry,
              clientId: client.id,
              clientName: client.name,
            }));
          } catch {
            return [] as DiaryRow[];
          }
        })
      );
      const merged = perClient.flat().sort((a, b) => `${b.date}`.localeCompare(`${a.date}`));
      setRows(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load food diaries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(true);
  }, [load]);

  function openReview(row: DiaryRow) {
    setFeedback('');
    setTarget(row);
  }

  async function sendRecommendation() {
    if (!recClientId || !recText.trim()) return;
    setSendingRec(true);
    try {
      await api(`chat/threads/${recClientId}/`, {
        method: 'POST',
        body: { kind: 'text', content: `Recommendation: ${recText.trim()}` },
      });
      setRecText('');
      Alert.alert('Sent', 'Your recommendation was sent to the client.');
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSendingRec(false);
    }
  }

  async function submitFeedback(approve: boolean) {
    if (!target) return;
    if (!approve && !feedback.trim()) {
      Alert.alert('Feedback required', 'Write a note before declining.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api<FoodDiaryEntry>(
        `clients/${target.clientId}/food-diary/${target.id}/feedback/`,
        { method: 'POST', body: { feedback: feedback.trim() } }
      );
      setRows((list) =>
        list.map((row) =>
          row.id === target.id
            ? { ...row, status: updated.status, trainer_feedback: updated.trainer_feedback }
            : row
        )
      );
      setTarget(null);
      setFeedback('');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const visible = rows.filter((row) => filter === 'all' || row.status === filter);

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingView label="Loading food diaries…" />
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

  return (
    <Screen refreshing={refreshing} onRefresh={() => void load()}>
      <View className="mt-5">
        <ScreenHeader
          title="Diary review"
          subtitle="Coach your clients on what they eat."
        />
      </View>

      <View className="mb-4">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'pending', label: 'Pending', icon: ClockIcon },
            { key: 'reviewed', label: 'Reviewed', icon: CheckCircle2Icon },
            { key: 'all', label: 'All', icon: UtensilsIcon },
          ]}
        />
      </View>

      <Panel tint={COLORS.violet} className="mb-5 gap-2.5">
        <View className="flex-row items-center gap-2">
          <View
            className="items-center justify-center rounded-xl p-2"
            style={{ backgroundColor: alpha(COLORS.violet, 0.2) }}>
            <SparklesIcon size={15} color={COLORS.violet} />
          </View>
          <Text className="text-[15px] font-bold tracking-tight">Send a recommendation</Text>
        </View>
        <Combobox
          value={recClientId}
          onValueChange={setRecClientId}
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
        <Textarea
          value={recText}
          onChangeText={setRecText}
          placeholder="e.g. Aim for 10k steps daily and swap sugary drinks for water."
        />
        <Button
          size="sm"
          disabled={sendingRec || !recClientId || !recText.trim()}
          onPress={() => void sendRecommendation()}
          className="self-start">
          <SendIcon size={14} color="#04110A" />
          <Text>{sendingRec ? 'Sending…' : 'Send recommendation'}</Text>
        </Button>
      </Panel>

      <View className="gap-3">
          {visible.length === 0 ? (
            <EmptyView
              icon={UtensilsIcon}
              color={COLORS.orange}
              title="Nothing to review"
              subtitle="Food diary entries from your clients show up here."
            />
          ) : (
            visible.map((row) => (
              <Panel
                key={`${row.clientId}-${row.id}`}
                tint={row.status === 'pending' ? COLORS.amber : COLORS.green}
                className="gap-2.5 p-3">
                <View className="flex-row gap-3">
                  {row.photo_url ? (
                    <Image
                      source={{ uri: row.photo_url }}
                      style={{ width: 68, height: 68, borderRadius: 16 }}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View
                      className="items-center justify-center rounded-2xl"
                      style={{ width: 68, height: 68, backgroundColor: alpha(COLORS.orange, 0.14) }}>
                      <Icon as={ImageIcon} size={22} color={COLORS.orange} />
                    </View>
                  )}
                  <View className="min-w-0 flex-1 gap-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="min-w-0 flex-1 text-[15px] font-bold" numberOfLines={1}>
                        {row.meal_name || 'Meal'}
                      </Text>
                      <Chip
                        label={row.status === 'pending' ? 'Pending' : 'Reviewed'}
                        color={row.status === 'pending' ? COLORS.amber : COLORS.green}
                      />
                    </View>
                    {/* Feature 29: actual vs intended entries are both
                        reviewed; intended entries are labelled. */}
                    {row.intent === 'intended' ? <Chip label="Intends to use" color={COLORS.sky} /> : null}
                    <Text variant="muted" className="text-xs">
                      {row.clientName} · {shortDate(row.date)}
                    </Text>
                    <Text variant="muted" className="text-sm" numberOfLines={2}>
                      {row.description}
                    </Text>
                    {row.calories != null ? (
                      <Text className="text-xs font-black" style={{ color: COLORS.orange }}>
                        {row.calories} kcal
                      </Text>
                    ) : null}
                  </View>
                </View>
                {row.status === 'pending' ? (
                  <Button size="sm" className="self-start rounded-xl" onPress={() => openReview(row)}>
                    <Text>Review</Text>
                  </Button>
                ) : row.trainer_feedback ? (
                  <Text variant="muted" className="text-xs">
                    Feedback: {row.trainer_feedback}
                  </Text>
                ) : null}
              </Panel>
            ))
          )}
      </View>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review entry</DialogTitle>
            <DialogDescription>
              {target ? `${target.clientName} · ${shortDate(target.date)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Feedback for the client (optional when approving)"
          />
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onPress={() => void submitFeedback(false)}>
              <Text>Decline</Text>
            </Button>
            <Button disabled={submitting} onPress={() => void submitFeedback(true)}>
              <Text>{submitting ? 'Saving…' : 'Approve'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
