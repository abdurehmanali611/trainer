import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeftIcon, ImagePlusIcon, SendIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { ErrorView, LoadingView } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { fetchPlatformChat, sendPlatformChat, type PlatformChatMessage } from '@/lib/platform';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

export default function PlatformSupportChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inputFocused, setInputFocused] = React.useState(false);
  // The stack header is hidden on this screen, so navigation lives on this
  // floating back chevron pinned under the status bar.
  const backButton = router.canGoBack() ? (
    <Pressable
      onPress={() => router.back()}
      accessibilityLabel="Go back"
      hitSlop={8}
      style={{ position: 'absolute', left: 16, top: insets.top + 4, zIndex: 20 }}
      className="h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm shadow-black/10 active:opacity-70">
      <Icon as={ChevronLeftIcon} size={18} />
    </Pressable>
  ) : null;
  const [messages, setMessages] = React.useState<PlatformChatMessage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [images, setImages] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadingUri, setUploadingUri] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetchPlatformChat();
      setMessages(res.messages);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load support chat.');
    }
  }, []);

  React.useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => clearInterval(interval);
  }, [load]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photos to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });
    if (result.canceled || result.assets.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        if (images.length + urls.length >= 5) break;
        setUploadingUri(asset.uri);
        const url = await uploadToCloudinary(asset.uri);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls].slice(0, 5));
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload image.');
    } finally {
      setUploading(false);
      setUploadingUri(null);
    }
  };

  const send = async () => {
    if ((!draft.trim() && images.length === 0) || sending) return;
    setSending(true);
    try {
      await sendPlatformChat(draft.trim(), images);
      setDraft('');
      setImages([]);
      await load();
    } catch (e) {
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (messages === null && !error) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false, title: 'Support' }} />
        <LoadingView label="Loading chat…" />
        {backButton}
      </View>
    );
  }

  if (error && messages === null) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false, title: 'Support' }} />
        <ErrorView error={error} onRetry={() => void load()} />
        {backButton}
      </View>
    );
  }

  const list = messages ?? [];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <Stack.Screen options={{ headerShown: false, title: 'Support chat' }} />
      {backButton}
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const fromAdmin = item.sender === 'admin';
          return (
            <View className={`mb-3 max-w-[85%] gap-1 ${fromAdmin ? 'self-start' : 'self-end'}`}>
              <View
                className={`rounded-2xl px-4 py-2 ${
                  fromAdmin ? 'rounded-tl-sm bg-muted' : 'rounded-tr-sm bg-primary'
                }`}>
                {item.body ? (
                  <Text
                    className={`text-sm ${fromAdmin ? 'text-foreground' : 'text-primary-foreground'}`}>
                    {item.body}
                  </Text>
                ) : null}
                {(item.media_urls?.length || item.image_url) ? (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {(item.media_urls?.length ? item.media_urls : [item.image_url].filter(Boolean)).map((uri, idx) => (
                      <Image
                        key={idx}
                        source={{ uri: uri as string }}
                        style={{ width: 140, height: 140, borderRadius: 12 }}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <Text variant="muted" className="text-xs">
                {item.is_broadcast ? 'Broadcast · ' : ''}
                {relativeTime(item.created_at)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-10">
            <Text variant="muted" className="text-sm">
              Start a conversation with the support team.
            </Text>
          </View>
        }
      />
      {images.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 border-t border-border px-4 py-2">
          {images.map((uri, idx) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 10 }} contentFit="cover" />
              <Pressable
                onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-foreground">
                <Text className="text-[10px] text-background">×</Text>
              </Pressable>
            </View>
          ))}
          {uploading && uploadingUri ? (
            <View className="h-[72px] w-[72px] items-center justify-center rounded-[10px] bg-muted">
              <Text variant="muted" className="text-xs">
                Uploading
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View
        className="flex-row items-end gap-2 border-t border-border px-4"
        style={{ paddingBottom: Math.max(insets.bottom, 12), paddingTop: 10 }}>
        <Pressable onPress={() => void pickImage()} disabled={uploading || images.length >= 5} className="mb-1">
          <Icon as={ImagePlusIcon} size={22} className={images.length >= 5 ? 'text-muted-foreground' : 'text-foreground'} />
        </Pressable>
        <View
          className={cn(
            'flex-1 rounded-2xl border px-3 py-2 transition-colors',
            inputFocused
              ? 'border-primary bg-card shadow-sm shadow-primary/25'
              : 'border-border bg-muted'
          )}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message support…"
            placeholderTextColor="#9CA3AF"
            multiline
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className="max-h-28 text-sm text-foreground outline-none"
          />
        </View>
        <Pressable
          onPress={() => void send()}
          disabled={sending || (!draft.trim() && images.length === 0)}
          className={`mb-1 h-9 w-9 items-center justify-center rounded-full ${
            sending || (!draft.trim() && images.length === 0) ? 'bg-muted' : 'bg-primary'
          }`}>
          <Icon as={SendIcon} size={16} className={sending || (!draft.trim() && images.length === 0) ? 'text-muted-foreground' : 'text-primary-foreground'} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
