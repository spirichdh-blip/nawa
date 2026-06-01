import { api } from './client'

export interface RegisterData {
  name: string
  phone: string
  password: string
  birthDate: string
  regionSi: string
  regionGu: string
  protectionEndDate: string
  protectionType: string
}

export const authApi = {
  register: (data: RegisterData) =>
    api.post<{ token: string; userId: string }>('/auth/register', data),

  login: (phone: string, password: string) =>
    api.post<{ token: string; userId: string; role: string }>('/auth/login', {
      phone,
      password,
    }),

  me: () => api.get('/auth/me'),
}
