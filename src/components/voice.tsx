import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { MicIcon, PauseIcon, PlayIcon, SquareIcon } from 'lucide-react-native';
import * as React from 'react';
import { Alert, Animated, Easing, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export function VoiceRecorderButton({
  onSend,
  disabled,
}: {
  onSend: (localUri: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [busy, setBusy] = React.useState(false);
  const [pulse] = React.useState(() => new Animated.Value(1));
  const recording = recorderState.isRecording;

  React.useEffect(() => {
    if (!recording) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.2,
          duration: 550,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [recording, pulse]);

  async function toggle() {
    if (busy) return;
    if (recording) {
      setBusy(true);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) await onSend(uri);
      } catch (e) {
        Alert.alert('Voice note not sent', errMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (disabled) return;
    setBusy(true);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone access', 'Allow microphone access to record voice notes.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      Alert.alert('Could not record', errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (recording) {
    return (
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel="Stop recording"
        className="flex-row items-center gap-2 rounded-full bg-destructive/10 px-3 py-2">
        <Animated.View
          style={{ opacity: pulse }}
          className="h-2.5 w-2.5 rounded-full bg-destructive"
        />
        <Text className="text-sm font-medium text-destructive">
          {clock(recorderState.durationMillis / 1000)}
        </Text>
        <Icon as={SquareIcon} size={13} className="text-destructive" />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Record voice note"        className={`h-10 w-10 items-center justify-center rounded-full active:bg-accent ${busy ? 'opacity-50' : ''}`}>
      <Icon as={MicIcon} size={22} className="text-muted-foreground" />
    </Pressable>
  );
}

export function VoicePlayer({ url, mine }: { url: string; mine: boolean }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const duration = status.duration > 0 && Number.isFinite(status.duration) ? status.duration : 0;
  const current = status.currentTime > 0 && Number.isFinite(status.currentTime) ? status.currentTime : 0;
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (duration > 0 && current >= duration - 0.15) {
      void player.seekTo(0);
    }
    player.play();
  }

  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        onPress={toggle}
        disabled={!status.isLoaded}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        className={`h-8 w-8 items-center justify-center rounded-full ${
          mine ? 'bg-primary-foreground/20' : 'bg-muted'
        } ${status.isLoaded ? '' : 'opacity-50'}`}>
        <Icon
          as={status.playing ? PauseIcon : PlayIcon}
          size={14}
          className={mine ? 'text-primary-foreground' : 'text-foreground'}
        />
      </Pressable>
      <View className="w-28 gap-1.5">
        <View
          className={`h-1 w-full overflow-hidden rounded-full ${
            mine ? 'bg-primary-foreground/25' : 'bg-border'
          }`}>
          <View
            className={`h-full rounded-full ${mine ? 'bg-primary-foreground' : 'bg-foreground'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </View>
        <Text className={`text-xs ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {clock(duration)}
        </Text>
      </View>
    </View>
  );
}
