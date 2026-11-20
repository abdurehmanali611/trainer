import { Stack, useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeftIcon, ImagePlusIcon, LifeBuoyIcon, SendIcon, XIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Gradient, oceanGradient } from '@/components/gradient';
import { alpha, COLORS, IconBubble } from '@/components/kit';
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
      <Gradient colors={oceanGradient} style={{ paddingTop: insets.top + 10, paddingBottom: 16 }}>
        <View className="flex-row items-center gap-3 px-4">
          {router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
              <Icon as={ChevronLeftIcon} size={20} color="#ffffff" />
            </Pressable>
          ) : null}
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-black tracking-tight text-white">Support</Text>
            <Text className="text-xs font-medium text-white/80">Chat with the Apex team</Text>
          </View>
          <Icon as={LifeBuoyIcon} size={26} color="#ffffff" />
        </View>
      </Gradient>
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        renderItem={({ item }) => {
          const fromAdmin = item.sender === 'admin';
          return (
            <View className={`mb-3 max-w-[85%] gap-1 ${fromAdmin ? 'self-start' : 'self-end'}`}>
              <View
                className={`rounded-3xl px-4 py-2.5 ${
                  fromAdmin ? 'rounded-bl-md border border-border bg-card' : 'rounded-br-md bg-primary'
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
          <View className="items-center justify-center gap-3 py-12">
            <IconBubble icon={LifeBuoyIcon} color={COLORS.sky} size={64} />
            <Text className="text-lg font-bold tracking-tight">How can we help?</Text>
            <Text variant="muted" className="text-center text-sm">
              Start a conversation with the support team.
            </Text>
          </View>
        }
      />
      {images.length > 0 || uploading ? (
        <View
          className="flex-row flex-wrap gap-2.5 border-t border-border px-4 pt-3"
          style={{ backgroundColor: '#0B1220' }}>
          {images.map((uri, idx) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 16 }} contentFit="cover" />
              <Pressable
                onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                hitSlop={6}
                className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: COLORS.rose }}>
                <Icon as={XIcon} size={13} color="#ffffff" />
              </Pressable>
            </View>
          ))}
          {uploading && uploadingUri ? (
            <View
              className="items-center justify-center rounded-2xl"
              style={{ width: 64, height: 64, backgroundColor: alpha(COLORS.cyan, 0.14) }}>
              <Text className="text-[11px] font-bold" style={{ color: COLORS.cyan }}>
                Uploading…
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View
        className={cn(
          'flex-row items-end gap-2.5 px-3 pt-2.5',
          images.length === 0 && !uploading && 'border-t border-border'
        )}
        style={{ paddingBottom: 12, backgroundColor: '#0B1220' }}>
        <Pressable
          onPress={() => void pickImage()}
          disabled={uploading || images.length >= 5}
          accessibilityLabel="Attach photos"
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
          style={{
            backgroundColor: alpha(COLORS.cyan, images.length >= 5 ? 0.05 : 0.14),
            borderWidth: 1,
            borderColor: alpha(COLORS.cyan, images.length >= 5 ? 0.15 : 0.4),
          }}>
          <Icon as={ImagePlusIcon} size={20} color={images.length >= 5 ? COLORS.muted : COLORS.cyan} />
        </Pressable>
        <View
          className="min-h-11 flex-1 justify-center rounded-3xl border px-4"
          style={{
            backgroundColor: inputFocused ? alpha(COLORS.green, 0.06) : '#101826',
            borderColor: inputFocused ? alpha(COLORS.green, 0.7) : '#1E293B',
          }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message support…"
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={1}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            selectionColor="#3ADD6C"
            cursorColor="#3ADD6C"
            textAlignVertical="center"
            className="max-h-28 py-2.5 text-[15px] text-foreground"
          />
        </View>
        <Pressable
          onPress={() => void send()}
          disabled={sending || (!draft.trim() && images.length === 0)}
          accessibilityLabel="Send"
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-80"
          style={{
            backgroundColor: sending || (!draft.trim() && images.length === 0) ? '#16222F' : COLORS.green,
          }}>
          <Icon
            as={SendIcon}
            size={19}
            color={sending || (!draft.trim() && images.length === 0) ? COLORS.muted : '#04110A'}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
