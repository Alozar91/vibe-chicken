/** Секции забоя (с выходами по видам) и продаж партии. */

import { useCallback, useEffect, useState } from 'react'
import {
  createSale,
  createSlaughter,
  deleteSale,
  deleteSlaughter,
  updateSale,
  updateSlaughter,
  listSales,
  listSlaughters,
} from '../../api/broiler'
import { listBuyers, listProductTypes } from '../../api/dictionaries'
import { listSettings } from '../../api/settings'
import { Button, Card, Checkbox, ErrorBox, Modal, TextInput } from '../../components/ui'
import { Select } from '../../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  batchId: number
  onChanged: () => void
}

interface OutputRow {
  product_type_id: string
  kg: string
}

export function SlaughtersSection({ batchId, onChanged }: Props) {
  const [items, setItems] = useState<
    { id: number; date: string; head_count: number; live_weight_kg: number; outputs: { id: number; kg: number; product_type_id: number; product_type_name: string | null }[] }[]
  >([])
  const [types, setTypes] = useState<{ id: number; name: string }[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [date, setDate] = useState(today())
  const [heads, setHeads] = useState('')
  const [rows, setRows] = useState<OutputRow[]>([{ product_type_id: '', kg: '' }])
  const [editingId, setEditingId] = useState<number | null>(null)

  // живой вес вычисляется из выхода продукции через коэффициент из настроек
  const [ratio, setRatio] = useState(0.7)
  useEffect(() => {
    void listSettings().then((all) => {
      const r = all.find((s) => s.key === 'output_ratio_tushka')
      if (r) setRatio(Number(r.value))
    })
  }, [])
  const outputKg = rows.reduce((acc, r) => acc + (Number(r.kg) || 0), 0)
  const liveWeight = outputKg > 0 ? (outputKg / ratio).toFixed(1) : null

  const reload = useCallback(async () => {
    setItems(await listSlaughters(batchId))
  }, [batchId])

  useEffect(() => {
    void reload()
    void listProductTypes().then(setTypes)
  }, [reload])


  const openModal = () => {
    setEditingId(null)
    setDate(today())
    setHeads('')
    setRows([{ product_type_id: types[0]?.id.toString() ?? '', kg: '' }])
    setError(null)
    setOpen(true)
  }

  const openEdit = (id: number, date: string, heads: number, outs: { product_type_id: number; kg: number }[]) => {
    setEditingId(id)
    setDate(date)
    setHeads(String(heads))
    setRows(outs.map((o) => ({ product_type_id: String(o.product_type_id), kg: String(o.kg) })))
    setError(null)
    setOpen(true)
  }

  const setRow = (i: number, patch: Partial<OutputRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        date,
        head_count: Number(heads),
        outputs: rows
          .filter((r) => r.kg && r.product_type_id)
          .map((r) => ({ product_type_id: Number(r.product_type_id), kg: Number(r.kg) })),
      }
      if (editingId !== null) {
        await updateSlaughter(batchId, editingId, payload)
      } else {
        await createSlaughter(batchId, payload)
      }
      setOpen(false)
      await reload()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Забой и разделка</h3>
        <Button onClick={openModal}>+</Button>
      </div>
      <ErrorBox message={error} />
      <ul className="mt-2 divide-y divide-slate-100">
        {items.map((s) => (
          <li key={s.id} className="py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-slate-700">
                {s.date} — {s.head_count} гол · живой вес {s.live_weight_kg} кг
              </span>
              <button
                className="text-xs text-amber-600 hover:underline"
                onClick={() => openEdit(s.id, s.date, s.head_count, s.outputs.map((o) => ({ product_type_id: o.product_type_id, kg: o.kg })))}
              >
                изменить
              </button>
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={async () => {
                  try {
                    await deleteSlaughter(batchId, s.id)
                    await reload()
                    onChanged()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Ошибка удаления')
                  }
                }}
              >
                удалить
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Выход:{' '}
              {s.outputs.map((o) => `${o.product_type_name ?? '—'} ${o.kg} кг`).join(', ') || '—'}
            </p>
          </li>
        ))}
        {items.length === 0 && <li className="py-1.5 text-sm text-slate-400">Пока пусто</li>}
      </ul>

      <Modal open={open} title={editingId !== null ? 'Изменить забой' : 'Забой и разделка'} onClose={() => { setOpen(false); setEditingId(null) }}>
        <ErrorBox message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          <TextInput value={date} onChange={setDate} placeholder="Дата" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput value={heads} onChange={setHeads} placeholder="Голов" required />
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Живой вес (расчёт): </span>
              <b className="text-slate-900">{liveWeight ? `${liveWeight} кг` : '—'}</b>
              <span className="ml-1 text-xs text-slate-400">(выход {Math.round(ratio * 100)}%)</span>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Выход продукции по видам (живой вес пересчитается сам):</p>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={r.product_type_id}
                      onChange={(v) => setRow(i, { product_type_id: v })}
                      options={types.map((t) => ({ value: t.id.toString(), label: t.name }))}
                    />
                  </div>
                  <div className="w-28">
                    <TextInput value={r.kg} onChange={(v) => setRow(i, { kg: v })} placeholder="Кг" />
                  </div>
                  {rows.length > 1 && (
                    <Button kind="secondary" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              kind="secondary"
              onClick={() => setRows((prev) => [...prev, { product_type_id: types[0]?.id.toString() ?? '', kg: '' }])}
            >
              + вид продукции
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

export function SalesSection({ batchId, onChanged }: Props) {
  const [items, setItems] = useState<
    { id: number; date: string; product_type_id: number; product_kg: number; price_per_kg: number; total_amount: number; buyer_id: number | null }[]
  >([])
  const [types, setTypes] = useState<{ id: number; name: string }[]>([])
  const [buyers, setBuyers] = useState<{ id: number; name: string }[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [date, setDate] = useState(today())
  const [typeId, setTypeId] = useState('')
  const [kg, setKg] = useState('')
  const [price, setPrice] = useState('')
  const [buyerId, setBuyerId] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    setItems(await listSales(batchId))
  }, [batchId])

  useEffect(() => {
    void reload()
    void (async () => {
      setTypes(await listProductTypes())
      setBuyers(await listBuyers())
    })()
  }, [reload])

  const buyerName = (id: number | null) =>
    id === null ? '' : buyers.find((b) => b.id === id)?.name ?? `#${id}`
  const typeName = (id: number) => types.find((t) => t.id === id)?.name ?? `#${id}`

  const openModal = () => {
    setEditingId(null)
    setDate(today())
    setTypeId(types[0]?.id.toString() ?? '')
    setKg('')
    setPrice('')
    setBuyerId('')
    setUseCustom(false)
    setCustomAmount('')
    setError(null)
    setOpen(true)
  }

  const openEdit = (sale: (typeof items)[number]) => {
    setEditingId(sale.id)
    setDate(sale.date)
    setTypeId(String(sale.product_type_id))
    setKg(String(sale.product_kg))
    setPrice(String(sale.price_per_kg))
    setBuyerId(sale.buyer_id ? String(sale.buyer_id) : '')
    const hasCustom = Math.abs(sale.total_amount - sale.product_kg * sale.price_per_kg) > 0.005
    setUseCustom(hasCustom)
    setCustomAmount(hasCustom ? String(sale.total_amount) : '')
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        date,
        product_type_id: Number(typeId),
        product_kg: Number(kg),
        price_per_kg: Number(price),
        buyer_id: buyerId ? Number(buyerId) : null,
        total_amount: useCustom && customAmount ? Number(customAmount) : null,
      }
      if (editingId !== null) {
        await updateSale(batchId, editingId, payload)
      } else {
        await createSale(batchId, payload)
      }
      setOpen(false)
      await reload()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Продажи</h3>
        <Button onClick={openModal}>+</Button>
      </div>
      <ErrorBox message={error} />
      <ul className="mt-2 divide-y divide-slate-100">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 text-slate-700">
              {s.date} — {typeName(s.product_type_id)} · {s.product_kg} кг × {s.price_per_kg} ₽ ={' '}
              <b>{s.total_amount} ₽</b>
              {s.buyer_id && <> · {buyerName(s.buyer_id)}</>}
            </span>
            <button className="text-xs text-amber-600 hover:underline" onClick={() => openEdit(s)}>
              изменить
            </button>
            <button
              className="text-xs text-red-500 hover:underline"
              onClick={async () => {
                try {
                  await deleteSale(batchId, s.id)
                  await reload()
                  onChanged()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Ошибка удаления')
                }
              }}
            >
              удалить
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="py-1.5 text-sm text-slate-400">Пока пусто</li>}
      </ul>

      <Modal open={open} title={editingId !== null ? 'Изменить продажу' : 'Продажа продукции'} onClose={() => { setOpen(false); setEditingId(null) }}>
        <ErrorBox message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          <TextInput value={date} onChange={setDate} placeholder="Дата" />
          <Select
            value={typeId}
            onChange={setTypeId}
            options={types.map((t) => ({ value: t.id.toString(), label: t.name }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput value={kg} onChange={setKg} placeholder="Кг" required />
            <TextInput value={price} onChange={setPrice} placeholder="Цена за кг, ₽" required />
          </div>
          <Select
            value={buyerId}
            onChange={setBuyerId}
            options={[{ value: '', label: 'Покупатель не указан' }, ...buyers.map((b) => ({ value: b.id.toString(), label: b.name }))]}
          />
          <Checkbox checked={useCustom} onChange={setUseCustom} label="Ввести сумму чека вручную (если отличается от кг×цена)" />
          {useCustom && (
            <TextInput value={customAmount} onChange={setCustomAmount} placeholder="Сумма по чеку, ₽" required />
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy || !typeId}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
