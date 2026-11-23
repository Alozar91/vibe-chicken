/** API настроек системы (коэффициенты и т.п.). */

import { api } from './client'
import type { AppSetting } from './types'

export const listSettings = () => api<AppSetting[]>('/api/settings')

export const updateSetting = (key: string, value: string) =>
  api<AppSetting>(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) })
