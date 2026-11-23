/** Секции событий партии: падёж, кормление, взвешивания, лечение.
 *  Каждая — самодостаточная карточка с модалкой добавления.
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createFeeding,
  createMortality,
  createTreatment,
  createWeighing,
  deleteFeeding,
  deleteMortality,
  deleteTreatment,
  deleteWeighing,
  updateFeeding,
  updateMortality,
  updateTreatment,
  updateWeighing,
  listFeedings,
  listMortalities,
  listTreatments,
  listWeighings,
} from '../../api/broiler'
import { listFeedBrands, listFeedCategories } from '../../api/dictionaries'
import { Button, Card, DateInput, ErrorBox, Modal, TextInput } from '../../components/ui'
import { Select } from '../../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

interface EventSectionProps<T> {
  title: string
  items: T[]
  renderRow: (item: T) => ReactNode
  /** Заполняет state формы значениями записи (для режима редактирования) */
  toForm?: (item: T) => void
  form: (onPayload: (payload: unknown) => void) => ReactNode
  onCreate: (payload: never) => Promise<unknown>
  onUpdate?: (id: number, payload: never) => Promise<unknown>
  onDelete: (id: number) => Promise<unknown>
}

function EventSection<T extends { id: number }>({ title, items, renderRow, toForm, form, onCreate, onUpdate, onDelete }: EventSectionProps<T>) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const payloadRef = { current: null as unknown }

  const openCreate = () => {
    setEditing(null)
    setError(null)
    setOpen(true)
  }

  const openEdit = (item: T) => {
    setEditing(item)
    setError(null)
    setOpen(true)
    // даём форме заполниться значениями записи
    setTimeout(() => toForm?.(item), 0)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (editing && onUpdate) {
        await onUpdate(editing.id, payloadRef.current as never)
      } else {
        await onCreate(payloadRef.current as never)
      }
      setOpen(false)
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Button onClick={openCreate}>+</Button>
      </div>
      <ErrorBox message={error} />
      <ul className="mt-2 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-700">{renderRow(item)}</span>
            {onUpdate && toForm && (
              <button className="text-xs text-amber-600 hover:underline" onClick={() => openEdit(item)}>
                изменить
              </button>
            )}
            <button
              className="text-xs text-red-500 hover:underline"
              onClick={async () => {
                try {
                  await onDelete(item.id)
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

      <Modal open={open} title={editing ? `Изменить — ${title}` : `Добавить — ${title}`} onClose={() => { setOpen(false); setEditing(null) }}>
        <ErrorBox message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          {form((payload) => {
            payloadRef.current = payload
          })}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => { setOpen(false); setEditing(null) }}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

interface Props {
  batchId: number
  onChanged: () => void
}

export function MortalitySection({ batchId, onChanged }: Props) {
  const [items, setItems] = useState<{ id: number; date: string; head_count: number; cause: string | null }[]>([])
  const reload = useCallback(async () => {
    setItems(await listMortalities(batchId))
  }, [batchId])
  useEffect(() => {
    void reload()
  }, [reload])

  const [date, setDate] = useState(today())
  const [heads, setHeads] = useState('')
  const [cause, setCause] = useState('')

  return (
    <EventSection
      title="Падёж"
      items={items}
      renderRow={(m) => `${m.date} — ${m.head_count} гол${m.cause ? ` · ${m.cause}` : ''}`}
      toForm={(m) => { setDate(m.date); setHeads(String(m.head_count)); setCause(m.cause ?? '') }}
      onCreate={async (payload: never) => {
        await createMortality(batchId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateMortality(batchId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteMortality(batchId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <MortalityFields date={date} setDate={setDate} heads={heads} setHeads={setHeads} cause={cause} setCause={setCause} onPayload={onPayload} />
      )}
    />
  )
}

function MortalityFields({ date, setDate, heads, setHeads, cause, setCause, onPayload }: {
  date: string; setDate: (v: string) => void; heads: string; setHeads: (v: string) => void
  cause: string; setCause: (v: string) => void; onPayload: (v: unknown) => void
}) {
  useEffect(() => {
    onPayload({ date, head_count: Number(heads), cause: cause.trim() || null })
  }, [date, heads, cause, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <TextInput value={heads} onChange={setHeads} placeholder="Голов" required />
      <TextInput value={cause} onChange={setCause} placeholder="Причина (необязательно)" />
    </>
  )
}

export function FeedingSection({ batchId, onChanged }: Props) {
  const [items, setItems] = useState<{ id: number; date: string; feed_category_id: number; feed_brand_id: number; kg: number }[]>([])
  const [cats, setCats] = useState<{ id: number; name: string }[]>([])
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([])
  const reload = useCallback(async () => {
    setItems(await listFeedings(batchId))
  }, [batchId])
  useEffect(() => {
    void reload()
    void (async () => {
      setCats(await listFeedCategories())
      setBrands(await listFeedBrands())
    })()
  }, [reload])
  const catName = (id: number) => cats.find((c) => c.id === id)?.name ?? `#${id}`
  const brandName = (id: number) => brands.find((b) => b.id === id)?.name ?? `#${id}`

  const [date, setDate] = useState(today())
  const [cat, setCat] = useState('')
  const [brand, setBrand] = useState('')
  const [kg, setKg] = useState('')

  return (
    <EventSection
      title="Кормление (списание со склада)"
      items={items}
      renderRow={(f) => `${f.date} — ${catName(f.feed_category_id)} / ${brandName(f.feed_brand_id)} · ${f.kg} кг`}
      toForm={(f) => { setDate(f.date); setCat(String(f.feed_category_id)); setBrand(String(f.feed_brand_id)); setKg(String(f.kg)) }}
      onCreate={async (payload: never) => {
        await createFeeding(batchId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateFeeding(batchId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteFeeding(batchId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <FeedingFields
          date={date} setDate={setDate} cat={cat} setCat={setCat} brand={brand} setBrand={setBrand}
          kg={kg} setKg={setKg} cats={cats} brands={brands} onPayload={onPayload}
        />
      )}
    />
  )
}

function FeedingFields({ date, setDate, cat, setCat, brand, setBrand, kg, setKg, cats, brands, onPayload }: {
  date: string; setDate: (v: string) => void
  cat: string; setCat: (v: string) => void; brand: string; setBrand: (v: string) => void
  kg: string; setKg: (v: string) => void
  cats: { id: number; name: string }[]; brands: { id: number; name: string }[]
  onPayload: (v: unknown) => void
}) {
  useEffect(() => {
    if (!cat && cats[0]) setCat(cats[0].id.toString())
    if (!brand && brands[0]) setBrand(brands[0].id.toString())
  }, [cats, brands, cat, brand, setCat, setBrand])
  useEffect(() => {
    onPayload({ date, feed_category_id: Number(cat), feed_brand_id: Number(brand), kg: Number(kg) })
  }, [date, cat, brand, kg, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <Select value={cat} onChange={setCat} options={cats.map((c) => ({ value: c.id.toString(), label: c.name }))} />
      <Select value={brand} onChange={setBrand} options={brands.map((b) => ({ value: b.id.toString(), label: b.name }))} />
      <TextInput value={kg} onChange={setKg} placeholder="Кг" required />
    </>
  )
}

export function WeighingSection({ batchId, onChanged }: Props) {
  const [items, setItems] = useState<{ id: number; date: string; head_count: number; avg_weight_kg: number }[]>([])
  const reload = useCallback(async () => {
    setItems(await listWeighings(batchId))
  }, [batchId])
  useEffect(() => {
    void reload()
  }, [reload])

  const [date, setDate] = useState(today())
  const [heads, setHeads] = useState('')
  const [avg, setAvg] = useState('')

  return (
    <EventSection
      title="Контрольные взвешивания"
      items={items}
      renderRow={(w) => `${w.date} — ${w.head_count} гол × ${w.avg_weight_kg} кг`}
      toForm={(w) => { setDate(w.date); setHeads(String(w.head_count)); setAvg(String(w.avg_weight_kg)) }}
      onCreate={async (payload: never) => {
        await createWeighing(batchId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateWeighing(batchId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteWeighing(batchId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <WeighingFields date={date} setDate={setDate} heads={heads} setHeads={setHeads} avg={avg} setAvg={setAvg} onPayload={onPayload} />
      )}
    />
  )
}

function WeighingFields({ date, setDate, heads, setHeads, avg, setAvg, onPayload }: {
  date: string; setDate: (v: string) => void; heads: string; setHeads: (v: string) => void
  avg: string; setAvg: (v: string) => void; onPayload: (v: unknown) => void
}) {
  useEffect(() => {
    onPayload({ date, head_count: Number(heads), avg_weight_kg: Number(avg) })
  }, [date, heads, avg, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <TextInput value={heads} onChange={setHeads} placeholder="Голов в выборке" required />
      <TextInput value={avg} onChange={setAvg} placeholder="Средний вес, кг" required />
    </>
  )
}

export function TreatmentSection({ batchId, onChanged }: Props) {
  const [items, setItems] = useState<{ id: number; date: string; description: string; cost: number }[]>([])
  const reload = useCallback(async () => {
    setItems(await listTreatments(batchId))
  }, [batchId])
  useEffect(() => {
    void reload()
  }, [reload])

  const [date, setDate] = useState(today())
  const [desc, setDesc] = useState('')
  const [cost, setCost] = useState('')

  return (
    <EventSection
      title="Обработки и лечение"
      items={items}
      renderRow={(t) => `${t.date} — ${t.description} (${t.cost} ₽)`}
      toForm={(t) => { setDate(t.date); setDesc(t.description); setCost(String(t.cost)) }}
      onCreate={async (payload: never) => {
        await createTreatment(batchId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateTreatment(batchId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteTreatment(batchId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <TreatmentFields date={date} setDate={setDate} desc={desc} setDesc={setDesc} cost={cost} setCost={setCost} onPayload={onPayload} />
      )}
    />
  )
}

function TreatmentFields({ date, setDate, desc, setDesc, cost, setCost, onPayload }: {
  date: string; setDate: (v: string) => void; desc: string; setDesc: (v: string) => void
  cost: string; setCost: (v: string) => void; onPayload: (v: unknown) => void
}) {
  useEffect(() => {
    onPayload({ date, description: desc, cost: Number(cost) })
  }, [date, desc, cost, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <TextInput value={desc} onChange={setDesc} placeholder="Описание" required />
      <TextInput value={cost} onChange={setCost} placeholder="Стоимость, ₽" required />
    </>
  )
}
