import { useFocusEffect, useRouter } from 'expo-router';
import { SendIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { EmptyView, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api, ApiError } from '@/lib/api';
import { relativeTime } from '@/lib/dates';
import type { ChatThread, Paginated } from '@/lib/types';
import { setUnreadCount } from '@/hooks/use-unread-chat';

export default function ChatListScreen() {
  const router = useRouter();
  const [threads, setThreads] = React.useState<ChatThread[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api<ChatThread[] | Paginated<ChatThread>>('chat/threads/');
      const list = Array.isArray(res) ? res : res.results;
      setThreads(list);
      setError(null);
      setUnreadCount(list.reduce((sum, t) => sum + (t.unread ?? 0), 0));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  let body: React.ReactNode;
  if (threads === null && !error) {
    body = <LoadingView label="Loading chats…" />;
  } else if (error) {
    body = <ErrorView error={error} onRetry={load} />;
  } else if (!threads || threads.length === 0) {
    body = <EmptyView title="No conversations yet" subtitle="Messages from your clients will show up here." />;
  } else {
    body = (
      <View className="flex-1 gap-2 px-4">
        {threads.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push(`/chat/${t.id}`)}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm shadow-black/[0.05] active:bg-accent/40 dark:shadow-black/30">
            <Avatar alt={t.name}>
              {t.avatar_url ? <AvatarImage source={{ uri: t.avatar_url }} /> : null}
              <AvatarFallback>
                <Text className="text-sm font-medium">{t.name.charAt(0).toUpperCase()}</Text>
              </AvatarFallback>
            </Avatar>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold">{t.name}</Text>
              <Text variant="muted" numberOfLines={1} className="text-sm">
                {t.last_message?.content || 'No messages yet'}
              </Text>
            </View>
            <View className="items-end gap-1.5">
              {t.last_message ? (
                <Text variant="muted" className="text-xs">
                  {relativeTime(t.last_message.created_at)}
                </Text>
              ) : null}
              {t.unread > 0 ? (
                <View className="h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5">
                  <Text className="text-xs font-semibold text-primary-foreground">
                    {t.unread > 99 ? '99+' : t.unread}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View className="px-4">
        <ScreenHeader
          title="Chat"
          right={
            <Button size="icon" variant="outline" onPress={() => router.push('/chat/broadcast')}>
              <Icon as={SendIcon} size={18} />
            </Button>
          }
        />
      </View>
      {body}
    </Screen>
  );
}
