import { api } from './client'

export interface User {
  id: number
  username: string
  role: 'admin' | 'user'
  is_active: boolean
}

export function login(username: string, password: string) {
  return api<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout() {
  return api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function me() {
  return api<User>('/api/auth/me')
}

export function changePassword(oldPassword: string, newPassword: string) {
  return api<void>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
}
