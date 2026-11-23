/** API резервных копий. */

import { api } from './client'

export interface BackupInfo {
  name: string
  size_kb: number
  created_at: string
}

export const listBackups = () => api<BackupInfo[]>('/api/backups')

export const createBackup = () =>
  api<BackupInfo>('/api/backups', { method: 'POST' })
