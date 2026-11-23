/** Страница «Настройки»: коэффициенты расчётов + резервные копии. */

import { useCallback, useEffect, useState } from 'react'
import { getPrices, updateProductType } from '../api/dictionaries'
import { listSettings, updateSetting } from '../api/settings'
import { createBackup, listBackups } from '../api/backups'
import { changePassword } from '../api/auth'
import type { AppSetting, Prices } from '../api/types'
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

  // справочник цен: яйцо + виды продукции
  const [prices, setPrices] = useState<Prices | null>(null)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savedPriceKey, setSavedPriceKey] = useState<string | null>(null)

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await listBackups())
    } catch {
      /* бэкапы — не критично для страницы настроек */
    }
  }, [])

  const loadPrices = useCallback(async () => {
    try {
      const p = await getPrices()
      setPrices(p)
      const drafts: Record<string, string> = { egg: p.egg_price_per_ten != null ? String(p.egg_price_per_ten) : '' }
      for (const t of p.products) drafts[`pt${t.id}`] = t.price != null ? String(t.price) : ''
      setPriceDrafts(drafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки цен')
    }
  }, [])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  useEffect(() => {
    void loadPrices()
  }, [loadPrices])

  const saveEggPrice = async () => {
    setSavedPriceKey(null)
    try {
      await updateSetting('egg_price_per_ten', priceDrafts.egg ?? '')
      setSavedPriceKey('egg')
      await loadPrices()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  const saveProductPrice = async (id: number, name: string, unit: string) => {
    setSavedPriceKey(null)
    try {
      const raw = (priceDrafts[`pt${id}`] ?? '').trim().replace(',', '.')
      const price = raw === '' ? null : Number(raw)
      await updateProductType(id, name, unit, price)
      setSavedPriceKey(`pt${id}`)
      await loadPrices()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

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

  const num = (s: string) => Number(s.replace(',', '.'))
  const eggDraft = priceDrafts.egg ?? ''

  return (
    <Page title="Настройки">
      <ErrorBox message={error} />

      <Card>
        <h3 className="font-semibold text-slate-900">Цены продукции</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Подставляются кнопкой «Цена из справочника» в формах продаж. Цены видов продукции — за их
          единицу (тушка — ₽/шт, потроха и печень — ₽/кг).
        </p>
        {prices && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
              <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
                Яйцо <span className="text-xs font-normal text-slate-400">₽/десяток</span>
              </span>
              <div className="w-28">
                <TextInput
                  value={eggDraft}
                  onChange={(v: string) => setPriceDrafts((prev) => ({ ...prev, egg: v }))}
                  placeholder="—"
                />
              </div>
              <Button
                kind="secondary"
                onClick={() => void saveEggPrice()}
                disabled={eggDraft === (prices.egg_price_per_ten != null ? String(prices.egg_price_per_ten) : '')}
              >
                Сохранить
              </Button>
              {savedPriceKey === 'egg' && <span className="text-sm text-green-600">✓</span>}
            </div>
            {prices.products.map((t) => {
              const draft = priceDrafts[`pt${t.id}`] ?? ''
              const unitLabel = t.unit === 'pieces' ? '₽/шт' : '₽/кг'
              return (
                <div key={t.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
                    {t.name} <span className="text-xs font-normal text-slate-400">{unitLabel}</span>
                  </span>
                  <div className="w-28">
                    <TextInput
                      value={draft}
                      onChange={(v: string) => setPriceDrafts((prev) => ({ ...prev, [`pt${t.id}`]: v }))}
                      placeholder="—"
                    />
                  </div>
                  <Button
                    kind="secondary"
                    onClick={() => void saveProductPrice(t.id, t.name, t.unit)}
                    disabled={
                      draft === (t.price != null ? String(t.price) : '') ||
                      (draft.trim() !== '' && Number.isNaN(num(draft)))
                    }
                  >
                    Сохранить
                  </Button>
                  {savedPriceKey === `pt${t.id}` && <span className="text-sm text-green-600">✓</span>}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="mt-4">
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

      <PasswordCard />
    </Page>
  )
}

/** Смена собственного пароля — доступна любому пользователю (concept §6). */
function PasswordCard() {
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (newPass !== repeat) throw new Error('Пароли не совпадают')
      await changePassword(oldPass, newPass)
      setSaved(true)
      setOldPass('')
      setNewPass('')
      setRepeat('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="font-semibold text-slate-900">Сменить пароль</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="mt-3 grid gap-2 sm:grid-cols-3"
      >
        <TextInput value={oldPass} onChange={setOldPass} placeholder="Старый пароль" required />
        <TextInput value={newPass} onChange={setNewPass} placeholder="Новый пароль" required />
        <TextInput value={repeat} onChange={setRepeat} placeholder="Повторите новый" required />
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy || !oldPass || !newPass}>
            Сменить
          </Button>
          {saved && <span className="ml-3 text-sm text-green-700">✓ Пароль изменён</span>}
          {error && <span className="ml-3 text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </Card>
  )
}
