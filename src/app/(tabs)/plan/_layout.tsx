import { Stack } from 'expo-router';

/**
 * The editors render the app header (with its own back chevron) inside the
 * page, so the native stack header is hidden — otherwise two back buttons show.
 */
export default function PlanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="workout/[id]" options={{ title: 'Workout plan' }} />
      <Stack.Screen name="diet/[id]" options={{ title: 'Diet plan' }} />
    </Stack>
  );
}
