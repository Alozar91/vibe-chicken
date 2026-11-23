/** Страница «Настройки»: коэффициенты расчётов (key-value из бэкенда). */

import { useEffect, useState } from 'react'
import { listSettings, updateSetting } from '../api/settings'
import type { AppSetting } from '../api/types'
import { Button, Card, ErrorBox, Page, TextInput } from '../components/ui'

export default function SettingsPage() {
  const [items, setItems] = useState<AppSetting[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    </Page>
  )
}
