import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi } from '../lib/api/auth'

interface AuthState {
  token: string | null
  userId: string | null
  role: string | null
  isLoading: boolean
  isAuthenticated: boolean

  login: (phone: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (phone, password) => {
    const { data } = await authApi.login(phone, password)
    await AsyncStorage.setItem('nawa_token', data.token)
    set({ token: data.token, userId: data.userId, role: data.role, isAuthenticated: true })
  },

  register: async (formData) => {
    const { data } = await authApi.register(formData)
    await AsyncStorage.setItem('nawa_token', data.token)
    set({ token: data.token, userId: data.userId, role: 'YOUTH', isAuthenticated: true })
  },

  logout: async () => {
    await AsyncStorage.removeItem('nawa_token')
    set({ token: null, userId: null, role: null, isAuthenticated: false })
  },

  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem('nawa_token')
      if (token) {
        set({ token, isAuthenticated: true })
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))
