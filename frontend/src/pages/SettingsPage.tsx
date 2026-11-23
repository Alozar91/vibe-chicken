/** Страница «Настройки»: коэффициенты расчётов + резервные копии. */

import { useCallback, useEffect, useState } from 'react'
import { listSettings, updateSetting } from '../api/settings'
import { geocodeAddress } from '../api/geocode'
import { createBackup, listBackups } from '../api/backups'
import { changePassword } from '../api/auth'
import type { AppSetting } from '../api/types'
import type { BackupInfo } from '../api/backups'
import { parseCoords } from '../lib/coords'
import { Button, Card, ErrorBox, GeocodeButton, Page, TextInput } from '../components/ui'

export default function SettingsPage() {
  const [items, setItems] = useState<AppSetting[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [backupBusy, setBackupBusy] = useState(false)

  // цена яйца по умолчанию (₽/десяток); цены видов продукции — в справочнике
  const [eggDraft, setEggDraft] = useState<string>('')
  const [eggSaved, setEggSaved] = useState(false)

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


  const saveEggPrice = async () => {
    setEggSaved(false)
    try {
      const updated = await updateSetting('egg_price_per_ten', eggDraft)
      setDrafts((prev) => ({ ...prev, egg_price_per_ten: updated.value }))
      setEggSaved(true)
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
        const egg = all.find((x) => x.key === 'egg_price_per_ten')
        setEggDraft(egg?.value ?? '')
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
        <h3 className="font-semibold text-slate-900">Цена яйца по умолчанию</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          ₽ за десяток. Подставляется кнопкой «Цена из справочника» в формах продажи яйца.
          Цены видов продукции задаются в справочнике «Виды продукции» — там же они и редактируются.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
          <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
            Яйцо <span className="text-xs font-normal text-slate-400">₽/десяток</span>
          </span>
          <div className="w-28">
            <TextInput
              value={eggDraft}
              onChange={(v: string) => {
                setEggDraft(v)
                setEggSaved(false)
              }}
              placeholder="—"
            />
          </div>
          <Button
            kind="secondary"
            onClick={() => void saveEggPrice()}
            disabled={eggDraft === (drafts['egg_price_per_ten'] ?? '')}
          >
            Сохранить
          </Button>
          {eggSaved && <span className="text-sm text-green-600">✓</span>}
        </div>
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
      <FarmAddressCard />
    </Page>
  )
}

/** Адрес и координаты хозяйства — стартовая точка всех маршрутов (§4.8). */
function FarmAddressCard() {
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState('')
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const items = await listSettings()
        const byKey = Object.fromEntries(items.map((s) => [s.key, s.value]))
        setAddress(byKey['farm_address'] ?? '')
        const lat = byKey['farm_lat'] ?? ''
        const lon = byKey['farm_lon'] ?? ''
        setCoords(lat && lon ? `${lat}, ${lon}` : '')
      } catch {
        /* настройки подтянутся при следующем обновлении */
      }
    })()
  }, [])

  const detect = async () => {
    if (!address.trim()) return
    setBusy(true)
    setGeoHint(null)
    try {
      const p = await geocodeAddress(address.trim())
      setCoords(`${p.lat}, ${p.lon}`)
      setGeoHint(`Найдено: ${p.label}`)
    } catch (e) {
      setGeoHint(e instanceof Error ? e.message : 'Не удалось определить')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const parsed = coords.trim() ? parseCoords(coords) : null
      if (coords.trim() && !parsed) throw new Error('Координаты не распознаны — формат: 54.1839, 45.1849')
      await updateSetting('farm_address', address.trim())
      await updateSetting('farm_lat', parsed ? String(parsed.lat) : '')
      await updateSetting('farm_lon', parsed ? String(parsed.lon) : '')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="font-semibold text-slate-900">Адрес хозяйства</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Стартовая точка маршрутов доставки. Координаты определяются кнопкой по адресу или
        вставляются из Яндекс.Карт.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="mt-3 space-y-2"
      >
        <div className="flex gap-2">
          <TextInput value={address} onChange={setAddress} placeholder="Адрес хозяйства (село, улица, дом)" />
          <GeocodeButton onClick={() => void detect()} disabled={busy || !address.trim()} />
        </div>
        <TextInput value={coords} onChange={setCoords} placeholder="Координаты: 54.1839, 45.1849" />
        {geoHint && <p className="text-xs text-slate-500">{geoHint}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            Сохранить
          </Button>
          {saved && <span className="text-sm text-green-700">✓ Сохранено</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </Card>
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
