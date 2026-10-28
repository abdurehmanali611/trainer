import { Stack, useRouter } from 'expo-router';
import { ChevronLeftIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';

export default function ClientLayout() {
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLeft: () => (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Go back"
            className="-ml-1 pr-3 active:opacity-60">
            <Icon as={ChevronLeftIcon} size={22} />
          </Pressable>
        ),
      }}>
      <Stack.Screen name="[id]" options={{ title: 'Client' }} />
    </Stack>
  );
}
