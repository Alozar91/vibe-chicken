/** API пользователей (управляет админ — concept §6). */

import { api } from './client'
import type { User } from './auth'

export interface UserFull extends User {
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
}

export const listUsers = () => api<UserFull[]>('/api/users')

export const createUser = (data: { username: string; password: string; role: string }) =>
  api<UserFull>('/api/users', { method: 'POST', body: JSON.stringify(data) })

export const updateUser = (
  id: number,
  data: { username?: string; password?: string; role?: string; is_active?: boolean },
) => api<UserFull>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
