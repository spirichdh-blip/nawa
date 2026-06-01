import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '@/store/authStore'

export default function LoginScreen() {
  const router = useRouter()
  const login = useAuthStore(s => s.login)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!phone || !password) return
    setLoading(true)
    try {
      await login(phone.replace(/-/g, ''), password)
      router.replace('/(tabs)')
    } catch {
      Alert.alert('로그인 실패', '전화번호 또는 비밀번호를 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.logo}>나와</Text>
        <Text style={styles.subtitle}>다시 돌아오셨군요 🌿</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="전화번호"
          keyboardType="phone-pad"
          autoFocus
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.btn, (!phone || !password) && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={!phone || !password || loading}
        >
          <Text style={styles.btnText}>{loading ? '로그인 중...' : '로그인'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← 처음으로</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 24 },
  header: { paddingTop: 80, paddingBottom: 40 },
  logo: { fontSize: 36, fontWeight: '800', color: '#1A6B4A' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  form: { gap: 14 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#2D9B6F',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  backLink: { alignItems: 'center', paddingVertical: 12 },
  backLinkText: { color: '#6B7280', fontSize: 14 },
})
