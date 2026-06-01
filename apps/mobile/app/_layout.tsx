import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export default function RootLayout() {
  const hydrate = useAuthStore(s => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welfare/[id]" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
