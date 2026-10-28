import { useRouter } from 'expo-router';
import { ArrowLeftIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import type { Client, Paginated } from '@/lib/types';

function errMessage(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.';
}

export default function BroadcastScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [clients, setClients] = React.useState<Client[] | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [content, setContent] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const loadPage = React.useCallback(
    async (pageToLoad: number, query: string) => {
      setError(null);
      try {
        const res = await api<Paginated<Client>>('clients/', { query: { page: pageToLoad, search: query } });
        setClients((prev) =>
          pageToLoad === 1 ? res.results : [...(prev ?? []), ...res.results]
        );
        setPage(pageToLoad);
        setHasMore(!!res.next);
      } catch (e) {
        setError(errMessage(e));
      }
    },
    []
  );

  React.useEffect(() => {
    loadPage(1, search);
  }, [search, loadPage]);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(page + 1, search);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const loaded = clients ?? [];
      const allSelected = loaded.length > 0 && loaded.every((c) => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(loaded.map((c) => c.id));
    });
  }

  const allLoadedSelected = (clients ?? []).length > 0 && (clients ?? []).every((c) => selected.has(c.id));

  async function send() {
    if (sending || selected.size === 0 || !content.trim()) return;
    setSending(true);
    try {
      const res = await api<{ broadcast_id: string; sent: number }>('chat/broadcast/', {
        method: 'POST',
        body: { client_ids: [...selected], content: content.trim() },
      });
      Alert.alert('Broadcast sent', `Message sent to ${res.sent} client${res.sent === 1 ? '' : 's'}.`);
      setContent('');
      setSelected(new Set());
    } catch (e) {
      Alert.alert('Broadcast failed', errMessage(e));
    } finally {
      setSending(false);
    }
  }

  let list: React.ReactNode;
  if (clients === null && !error) {
    list = (
      <View className="flex-1 gap-2 px-4 pt-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </View>
    );
  } else if (error) {
    list = (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="h4">Something went wrong</Text>
        <Text variant="muted" className="text-center">
          {error}
        </Text>
        <Text className="text-sm font-medium text-primary" onPress={() => loadPage(1, search)}>
          Tap to retry
        </Text>
      </View>
    );
  } else {
    list = (
      <FlatList
        className="flex-1"
        data={clients ?? []}
        keyExtractor={(c) => String(c.id)}
        contentContainerClassName="px-4 py-2"
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggle(item.id)}
            className="flex-row items-center gap-3 border-b border-border py-3 active:bg-accent">
            <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
            <View className="flex-1">
              <Text className="text-sm font-medium">{item.name}</Text>
              {item.phone ? (
                <Text variant="muted" className="text-xs">
                  {item.phone}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          loadingMore ? (
            <Skeleton className="m-4 h-10 w-full" />
          ) : hasMore ? (
            <Button variant="ghost" onPress={loadMore} className="my-2">
              <Text className="text-sm">Load more</Text>
            </Button>
          ) : undefined
        }
        ListEmptyComponent={
          <Text variant="muted" className="py-8 text-center text-sm">
            No clients found.
          </Text>
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-row items-center gap-2 border-b border-border px-2 py-2"
        style={{ paddingTop: insets.top + 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-2">
          <Icon as={ArrowLeftIcon} size={22} />
        </Pressable>
        <Text variant="h4" className="flex-1 text-xl">
          Broadcast
        </Text>
      </View>

      <View className="px-4 pt-3">
        <Input
          placeholder="Search clients"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View className="mt-3 flex-row items-center justify-between">
          <Text variant="muted" className="text-sm">
            {selected.size} selected
          </Text>
          <Button variant="link" size="sm" onPress={toggleAll} disabled={!clients || clients.length === 0}>
            <Text className="text-sm">{allLoadedSelected ? 'Clear all' : 'Select all'}</Text>
          </Button>
        </View>
      </View>

      {list}

      <View
        className="gap-2 border-t border-border px-4 py-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Textarea
          placeholder="Message to send"
          value={content}
          onChangeText={setContent}
          numberOfLines={3}
        />
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="muted" className="text-sm">
            Sending to {selected.size} client{selected.size === 1 ? '' : 's'}
          </Text>
          <Button disabled={sending || selected.size === 0 || !content.trim()} onPress={send}>
            <Text className="text-sm font-medium">{sending ? 'Sending…' : 'Send broadcast'}</Text>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
