import { Redirect } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { View, ActivityIndicator } from 'react-native'

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F9F4' }}>
        <ActivityIndicator size="large" color="#2D9B6F" />
      </View>
    )
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/welcome'} />
}
