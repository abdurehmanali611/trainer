import { Stack } from 'expo-router';

export default function SupportChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Support chat', headerShown: false }} />
    </Stack>
  );
}
