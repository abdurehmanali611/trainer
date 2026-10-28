import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="notifications" options={{ headerShown: false, title: 'Notifications' }} />
      <Stack.Screen name="payment-instructions" options={{ headerShown: false, title: 'Payment instructions' }} />
      <Stack.Screen name="diary-review" options={{ headerShown: false, title: 'Diary review' }} />
      <Stack.Screen name="profile" options={{ headerShown: false, title: 'Profile' }} />
    </Stack>
  );
}
