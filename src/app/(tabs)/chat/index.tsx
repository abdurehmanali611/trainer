import { useFocusEffect, useRouter } from 'expo-router';
import { MessagesSquareIcon, MegaphoneIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { alpha, COLORS, Panel } from '@/components/kit';
import { EmptyView, ErrorView, LoadingView, Screen, ScreenHeader } from '@/components/screen';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    body = (
      <EmptyView
        icon={MessagesSquareIcon}
        color={COLORS.cyan}
        title="No conversations yet"
        subtitle="Messages from your clients will show up here."
      />
    );
  } else {
    body = (
      <View className="flex-1 gap-2 px-4">
        {threads.map((t) => (
          <Panel
            key={t.id}
            tint={t.unread > 0 ? COLORS.green : undefined}
            onPress={() => router.push(`/chat/${t.id}`)}
            className="flex-row items-center gap-3 p-3.5">
            <View
              style={{
                padding: 2,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: t.unread > 0 ? COLORS.green : alpha(COLORS.cyan, 0.5),
              }}>
              <Avatar alt={t.name} className="h-11 w-11">
                {t.avatar_url ? <AvatarImage source={{ uri: t.avatar_url }} /> : null}
                <AvatarFallback>
                  <Text className="text-sm font-black" style={{ color: COLORS.cyan }}>
                    {t.name.charAt(0).toUpperCase()}
                  </Text>
                </AvatarFallback>
              </Avatar>
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-[15px] font-bold" numberOfLines={1}>
                {t.name}
              </Text>
              <Text
                variant="muted"
                numberOfLines={1}
                className={t.unread > 0 ? 'text-sm font-semibold text-foreground' : 'text-sm'}>
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
                <View
                  className="h-5 min-w-5 items-center justify-center rounded-full px-1.5"
                  style={{ backgroundColor: COLORS.green }}>
                  <Text className="text-xs font-black" style={{ color: '#04110A' }}>
                    {t.unread > 99 ? '99+' : t.unread}
                  </Text>
                </View>
              ) : null}
            </View>
          </Panel>
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
            <Pressable
              onPress={() => router.push('/chat/broadcast')}
              accessibilityRole="button"
              accessibilityLabel="Broadcast"
              className="h-11 flex-row items-center gap-2 rounded-2xl px-4 active:opacity-80"
              style={{ backgroundColor: alpha(COLORS.pink, 0.16), borderWidth: 1, borderColor: alpha(COLORS.pink, 0.4) }}>
              <Icon as={MegaphoneIcon} size={17} color={COLORS.pink} />
              <Text className="text-sm font-black" style={{ color: COLORS.pink }}>
                Broadcast
              </Text>
            </Pressable>
          }
        />
      </View>
      {body}
    </Screen>
  );
}
