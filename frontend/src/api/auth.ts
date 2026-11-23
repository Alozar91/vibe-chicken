import { api } from './client'

export interface User {
  id: number
  username: string
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
