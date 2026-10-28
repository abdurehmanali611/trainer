import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ImagePlusIcon, SendIcon, XIcon } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, ErrorView, LoadingView } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VoicePlayer, VoiceRecorderButton } from '@/components/voice';
import { setUnreadCount } from '@/hooks/use-unread-chat';
import { api, ApiError } from '@/lib/api';
import { uploadAudioToCloudinary, uploadToCloudinary } from '@/lib/cloudinary';
import { shortTime } from '@/lib/dates';
import type { ChatThread, Message, Paginated } from '@/lib/types';

const PAGE_LIMIT = 100;
const OLDER_LIMIT = 50;
const MAX_IMAGES = 5;

function errMessage(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.';
}

async function refreshUnreadBadge() {
  try {
    const res = await api<ChatThread[] | Paginated<ChatThread>>('chat/threads/');
    const list = Array.isArray(res) ? res : res.results;
    setUnreadCount(list.reduce((sum, t) => sum + (t.unread ?? 0), 0));
  } catch {
    setUnreadCount(0);
  }
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const insets = useSafeAreaInsets();

  const [clientName, setClientName] = React.useState('Chat');
  const [messages, setMessages] = React.useState<Message[] | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [olderLoading, setOlderLoading] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [attachments, setAttachments] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);
  const loadingOlderRef = React.useRef(false);

  const markRead = React.useCallback(async () => {
    try {
      await api(`chat/threads/${clientId}/read/`, { method: 'POST', body: {} });
      await refreshUnreadBadge();
    } catch {
      return;
    }
  }, [clientId]);

  const loadInitial = React.useCallback(async () => {
    setError(null);
    try {
      const [msgs, client] = await Promise.all([
        api<Message[]>(`chat/threads/${clientId}/`, { query: { limit: PAGE_LIMIT } }),
        api<{ name: string }>(`clients/${clientId}/`),
      ]);
      setMessages(msgs);
      setHasMore(msgs.length >= OLDER_LIMIT);
      setClientName(client.name);
      await markRead();
    } catch (e) {
      setError(errMessage(e));
    }
  }, [clientId, markRead]);

  React.useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useFocusEffect(
    React.useCallback(() => {
      markRead();
    }, [markRead])
  );

  async function loadOlder() {
    if (loadingOlderRef.current || !hasMore || !messages || messages.length === 0) return;
    loadingOlderRef.current = true;
    setOlderLoading(true);
    try {
      const older = await api<Message[]>(`chat/threads/${clientId}/`, {
        query: { before: messages[0].created_at, limit: OLDER_LIMIT },
      });
      setMessages((prev) => {
        if (!prev) return prev;
        const known = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !known.has(m.id)), ...prev];
      });
      setHasMore(older.length >= OLDER_LIMIT);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      loadingOlderRef.current = false;
      setOlderLoading(false);
    }
  }

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.8,
    });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri);
    setAttachments((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
  }

  async function send() {
    const text = draft.trim();
    if (sending || (attachments.length === 0 && !text)) return;
    setSending(true);
    try {
      let mediaUrls: string[] = [];
      if (attachments.length > 0) {
        mediaUrls = await Promise.all(attachments.map((uri) => uploadToCloudinary(uri)));
      }
      const kind = mediaUrls.length > 0 ? 'image' : 'text';
      const created = await api<Message>(`chat/threads/${clientId}/`, {
        method: 'POST',
        body: { kind, content: text, media_urls: mediaUrls },
      });
      setMessages((prev) => [...(prev ?? []), created]);
      setDraft('');
      setAttachments([]);
    } catch (e) {
      Alert.alert('Message not sent', errMessage(e));
    } finally {
      setSending(false);
    }
  }

  const invertedData = React.useMemo(() => [...(messages ?? [])].reverse(), [messages]);

  const sendVoice = React.useCallback(
    async (localUri: string) => {
      setSending(true);
      try {
        const url = await uploadAudioToCloudinary(localUri);
        const created = await api<Message>(`chat/threads/${clientId}/`, {
          method: 'POST',
          body: { kind: 'voice', content: '', media_urls: [url] },
        });
        setMessages((prev) => [...(prev ?? []), created]);
      } catch (e) {
        Alert.alert('Voice note not sent', errMessage(e));
      } finally {
        setSending(false);
      }
    },
    [clientId]
  );

  if (messages === null && !error) {
    return (
      <>
        <Stack.Screen options={{ title: clientName }} />
        <LoadingView label="Loading conversation…" />
      </>
    );
  }

  if (error && messages === null) {
    return (
      <>
        <Stack.Screen options={{ title: clientName }} />
        <ErrorView error={error} onRetry={loadInitial} />
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}>
      <Stack.Screen options={{ title: clientName }} />
      <FlatList
        data={invertedData}
        inverted
        keyboardDismissMode="interactive"
        contentContainerClassName="px-4 py-3"
        keyExtractor={(m) => String(m.id)}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.4}
        ListFooterComponent={olderLoading ? <ActivityIndicator className="py-3" /> : undefined}
        renderItem={({ item }) => (
          <MessageBubble message={item} onOpenImage={setViewerUri} />
        )}
      />

      {attachments.length > 0 ? (
        <View className="flex-row gap-2 border-t border-border px-3 py-2">
          {attachments.map((uri) => (
            <View key={uri}>
              <Image source={{ uri }} contentFit="cover" className="h-14 w-14 rounded-md" />
              <Pressable
                onPress={() => setAttachments((prev) => prev.filter((u) => u !== uri))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5">
                <Icon as={XIcon} size={12} className="text-background" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View
        className="flex-row items-center gap-2 border-t border-border bg-background px-3 py-2"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <Pressable
          onPress={pickImages}
          hitSlop={8}
          accessibilityLabel="Add photos"
          className="h-10 w-10 items-center justify-center rounded-full active:bg-accent">
          <Icon as={ImagePlusIcon} size={22} className="text-muted-foreground" />
        </Pressable>
        <TextInput
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground"
          style={{ textAlignVertical: 'center' }}
          placeholder="Message"
          placeholderTextColor="#8E8E93"
          multiline
          value={draft}
          onChangeText={setDraft}
        />
        <VoiceRecorderButton onSend={sendVoice} disabled={sending} />
        <Pressable
          onPress={send}
          disabled={sending || (attachments.length === 0 && !draft.trim())}
          hitSlop={8}
          className={`h-10 w-10 items-center justify-center rounded-full bg-primary ${
            sending || (attachments.length === 0 && !draft.trim()) ? 'opacity-50' : ''
          }`}>
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Icon as={SendIcon} size={20} className="text-primary-foreground" />
          )}
        </Pressable>
      </View>

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/90" onPress={() => setViewerUri(null)}>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} contentFit="contain" style={{ width: '100%', height: '80%' }} />
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, onOpenImage }: { message: Message; onOpenImage: (uri: string) => void }) {
  const mine = message.sender_type === 'trainer';
  return (
    <View className={`mb-2 flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
      <View
        className={`max-w-[80%] gap-1.5 rounded-2xl px-3 py-2 ${
          mine ? 'bg-primary' : 'bg-secondary'
        }`}>
        {message.is_broadcast ? (
          <Badge label="Broadcast" tone="info" className="self-start" />
        ) : null}
        {message.kind === 'text' ? (
          <Text className={`text-base ${mine ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>
            {message.content}
          </Text>
        ) : null}
        {message.kind === 'image' ? (
          <View className="flex-row flex-wrap gap-1.5">
            {message.media_urls.map((url) => (
              <Pressable key={url} onPress={() => onOpenImage(url)}>
                <Image source={{ uri: url }} contentFit="cover" className="h-28 w-28 rounded-xl" />
              </Pressable>
            ))}
            {message.content ? (
              <Text className={`text-base ${mine ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>
                {message.content}
              </Text>
            ) : null}
          </View>
        ) : null}
        {message.kind === 'voice' ? (
          message.media_urls.length > 0 ? (
            <VoicePlayer url={message.media_urls[0]} mine={mine} />
          ) : (
            <Text className={`text-sm ${mine ? 'text-primary-foreground' : 'text-secondary-foreground'}`}>
              Voice note
            </Text>
          )
        ) : null}
        <Text className={`text-xs ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {shortTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}
