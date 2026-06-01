import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:4000'

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
})

api.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('nawa_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('nawa_token')
      // 로그아웃 처리는 authStore에서
    }
    return Promise.reject(err)
  }
)
