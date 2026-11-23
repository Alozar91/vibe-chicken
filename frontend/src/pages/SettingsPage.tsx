/** Страница «Настройки»: коэффициенты расчётов + резервные копии. */

import { useCallback, useEffect, useState } from 'react'
import { listSettings, updateSetting } from '../api/settings'
import { createBackup, listBackups } from '../api/backups'
import type { AppSetting } from '../api/types'
import type { BackupInfo } from '../api/backups'
import { Button, Card, ErrorBox, Page, TextInput } from '../components/ui'

export default function SettingsPage() {
  const [items, setItems] = useState<AppSetting[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [backupBusy, setBackupBusy] = useState(false)

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await listBackups())
    } catch {
      /* бэкапы — не критично для страницы настроек */
    }
  }, [])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  const doBackup = async () => {
    setBackupBusy(true)
    try {
      await createBackup()
      await loadBackups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка бэкапа')
    } finally {
      setBackupBusy(false)
    }
  }

  useEffect(() => {
    void listSettings()
      .then((all: AppSetting[]) => {
        setItems(all)
        setDrafts(Object.fromEntries(all.map((s) => [s.key, s.value])))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
  }, [])

  const save = async (key: string) => {
    setBusy(true)
    setError(null)
    setSavedKey(null)
    try {
      const updated = await updateSetting(key, drafts[key])
      setItems((prev) => prev.map((s) => (s.key === key ? updated : s)))
      setSavedKey(key)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Настройки">
      <ErrorBox message={error} />
      <Card>
        <p className="text-sm text-slate-500">
          Коэффициенты используются для автоматических пересчётов (например, живого веса при забое).
        </p>
        <div className="mt-3 space-y-4">
          {items.map((s) => (
            <div key={s.key} className="rounded-xl bg-slate-50 p-3">
              <p className="font-medium text-slate-900">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{s.hint}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-32">
                  <TextInput
                    value={drafts[s.key] ?? ''}
                    onChange={(v: string) => setDrafts((prev) => ({ ...prev, [s.key]: v }))}
                  />
                </div>
                <Button onClick={() => void save(s.key)} disabled={busy || drafts[s.key] === s.value}>
                  Сохранить
                </Button>
                {savedKey === s.key && <span className="text-sm text-green-600">Сохранено ✓</span>}
                {drafts[s.key] !== s.value && s.value !== s.default && (
                  <span className="text-xs text-slate-400">по умолчанию: {s.default}</span>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && !error && (
            <p className="text-sm text-slate-400">Настроек пока нет</p>
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">Резервные копии</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Каждую ночь в 03:00 копия создаётся автоматически; хранятся последние 14.
              Файлы: backend/data/backups/.
            </p>
          </div>
          <Button onClick={() => void doBackup()} disabled={backupBusy}>
            {backupBusy ? 'Копирую…' : 'Сделать копию'}
          </Button>
        </div>
        <div className="mt-3 space-y-1">
          {backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-slate-600">{b.name}</span>
              <span className="text-xs text-slate-400">{b.size_kb} КБ</span>
            </div>
          ))}
          {backups.length === 0 && (
            <p className="text-sm text-slate-400">Копий пока нет — сделайте первую</p>
          )}
        </div>
      </Card>
    </Page>
  )
}
