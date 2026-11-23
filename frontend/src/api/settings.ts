/** API настроек системы (коэффициенты и т.п.). */

import { api } from './client'
import type { AppSetting } from './types'

export const listSettings = () => api<AppSetting[]>('/settings')

export const updateSetting = (key: string, value: string) =>
  api<AppSetting>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) })
