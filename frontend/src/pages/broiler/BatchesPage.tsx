/** Страница «Партии бройлеров»: список партий + создание в модалке.
 *  Метрики считаются на бэкенде; здесь только представление.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createBatch,
  updateBatch,
  listBatches,
  closeBatch,
  suggestNextCode,
} from '../../api/broiler'
import { listPlaces, listVendors } from '../../api/dictionaries'
import type { BroilerBatch, Place } from '../../api/types'
import { Button, Card, DateInput, ErrorBox, Modal, Page, Select, TextInput } from '../../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

export default function BatchesPage() {
  const [batches, setBatches] = useState<BroilerBatch[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [chicksVendors, setChicksVendors] = useState<{ id: number; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [code, setCode] = useState(`B-${today().slice(0, 7).replace('-', '')}-`)
  const [placeId, setPlaceId] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [arrivalAge, setArrivalAge] = useState('1')
  const [headCount, setHeadCount] = useState('')
  const [cross, setCross] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [pricePerHead, setPricePerHead] = useState('')
  const [avgWeight, setAvgWeight] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const [b, p, v] = await Promise.all([
        listBatches(),
        listPlaces(),
        listVendors('chicks'),
      ])
      setBatches(b)
      setPlaces(p.filter((x) => x.kind === 'broiler_module'))
      setChicksVendors(v.map((x) => ({ id: x.id, name: x.name })))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const placeName = (id: number) => places.find((p) => p.id === id)?.name ?? `#${id}`
  // возраст партии сегодня: дни с поступления + возраст при поступлении (§4.1)
  const batchAge = (b: BroilerBatch) =>
    Math.max(0, Math.floor((Date.now() - new Date(b.start_date + 'T00:00:00').getTime()) / 86400000)) + b.arrival_age_days
  const vendorName = (id: number) => chicksVendors.find((v) => v.id === id)?.name ?? `#${id}`

  const openEdit = (b: BroilerBatch) => {
    setEditingId(b.id)
    setCode(b.code)
    setPlaceId(String(b.place_id))
    setStartDate(b.start_date)
    setArrivalAge(String(b.arrival_age_days))
    setHeadCount(String(b.head_count))
    setCross(b.cross ?? '')
    setVendorId(String(b.vendor_id))
    setPricePerHead(String(b.chick_price_per_head))
    setAvgWeight(b.chick_avg_weight_kg ? String(Math.round(b.chick_avg_weight_kg * 1000)) : '')
    setFormError(null)
    setModalOpen(true)
  }

  /** Локальная подсказка: префикс месяца + следующий номер по уже загруженным партиям. */
  const localNextCode = () => {
    const prefix = `B-${today().slice(0, 7).replace('-', '')}`
    let maxN = 0
    for (const b of batches) {
      const m = b.code.match(new RegExp(`^${prefix}-(\\d+)$`))
      if (m) maxN = Math.max(maxN, Number(m[1]))
    }
    return `${prefix}-${maxN + 1}`
  }

  const openCreate = () => {
    setEditingId(null)
    setCode(localNextCode())
    // уточняем с сервера (там полный список, включая чужие сессии)
    void suggestNextCode().then((c) => {
      if (!editingId) setCode(c)
    }).catch(() => undefined)
    setPlaceId(places[0]?.id.toString() ?? '')
    setStartDate(today())
    setArrivalAge('1')
    setHeadCount('')
    setCross('')
    setVendorId(chicksVendors[0]?.id.toString() ?? '')
    setPricePerHead('')
    setAvgWeight('')
    setFormError(null)
    setModalOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    setFormError(null)
    try {
      const payload = {
        code: code.trim(),
        place_id: Number(placeId),
        start_date: startDate,
        arrival_age_days: Number(arrivalAge) || 1,
        head_count: Number(headCount),
        cross: cross.trim() || null,
        vendor_id: Number(vendorId),
        chick_price_per_head: Number(pricePerHead.replace(",", ".")),
        chick_avg_weight_kg: avgWeight.trim() ? Number(avgWeight.replace(",", ".")) / 1000 : null,
      }
      if (editingId !== null) {
        await updateBatch(editingId, payload)
      } else {
        await createBatch(payload)
      }
      setModalOpen(false)
      await refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const doClose = async (id: number) => {
    setBusy(true)
    try {
      await closeBatch(id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  const noVendors = chicksVendors.length === 0

  return (
    <Page title="Партии бройлеров">
      <ErrorBox message={error} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Список партий</h3>
          <Button onClick={openCreate} disabled={noVendors}>
            Новая партия
          </Button>
        </div>
        {noVendors && (
          <p className="mt-2 text-sm text-slate-500">
            Нет продавцов с тегом «Цыплята» — добавьте в разделе «Продавцы».
          </p>
        )}
        {loading && <p className="mt-3 text-sm text-slate-400">Загрузка…</p>}
        {!loading && batches.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">Партий пока нет</p>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {batches.map((b) => (
          <Card key={b.id} className="!p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/batches/${b.id}`} className="text-lg font-semibold text-amber-600 hover:underline">
                {b.code}
              </Link>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {b.status === 'active' ? 'активна' : 'закрыта'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {b.start_date} · {placeName(b.place_id)} · {b.head_count} гол · {b.chick_price_per_head} ₽/гол ·{' '}
              {b.status === 'active' ? batchAge(b) + ' дн · ' : ''}
              {vendorName(b.vendor_id)}
              {b.cross && <> · кросс {b.cross}</>}
              {b.chick_avg_weight_kg && <> · {Math.round(b.chick_avg_weight_kg * 1000)} г/гол</>}
            </p>
            <div className="mt-2 flex gap-2">
              <Link
                to={`/batches/${b.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Открыть
              </Link>
              <button
                onClick={() => openEdit(b)}
                className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50"
              >
                Изменить
              </button>
              {b.status === 'active' && (
                <Button kind="secondary" onClick={() => doClose(b.id)} disabled={busy}>
                  Закрыть партию
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} title={editingId !== null ? 'Изменить партию' : 'Новая партия'} onClose={() => { setModalOpen(false); setEditingId(null) }}>
        <ErrorBox message={formError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          <TextInput value={code} onChange={setCode} placeholder="Номер партии" required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="w-full">
              <Select
                value={placeId}
                onChange={setPlaceId}
                options={places.map((p) => ({ value: p.id.toString(), label: p.name }))}
              />
            </div>
            <DateInput value={startDate} onChange={setStartDate} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextInput value={arrivalAge} onChange={setArrivalAge} placeholder="Возраст, дней" required />
            <TextInput value={headCount} onChange={setHeadCount} placeholder="Голов" required />
            <TextInput value={cross} onChange={setCross} placeholder="Кросс (необязательно)" />
          </div>
          <div className="w-full">
            <Select
              value={vendorId}
              onChange={setVendorId}
              options={chicksVendors.map((v) => ({ value: v.id.toString(), label: v.name }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput value={pricePerHead} onChange={setPricePerHead} placeholder="Цена за голову, ₽" required />
            <TextInput value={avgWeight} onChange={setAvgWeight} placeholder="Вес цыплёнка, г (для FCR)" />
          </div>
          <p className="text-xs text-slate-400">
            Возраст при поступлении: 1 — суточные цыплята; для подрощенных укажите фактический
            возраст — он будет расти от даты поступления. Расходы на партию распределяются только
            со дня её появления на ферме, уводить дату в прошлое не нужно.
            Вес цыплёнка в граммах (например 42); позволяет считать конверсию корма (FCR) сразу;
            без него FCR появится после двух контрольных взвешиваний.
            {editingId !== null && ' При изменении цены/голов запись закупки в журнале денег обновится автоматически.'}
          </p>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy || !placeId || !vendorId}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => { setModalOpen(false); setEditingId(null) }}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
