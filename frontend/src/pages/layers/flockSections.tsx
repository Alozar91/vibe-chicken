/** Секции событий стада несушек: поголовье, сбор яйца, кормление, самопотребление. */

import { useCallback, useEffect, useState } from 'react'
import {
  createChange,
  createCollection,
  createFeeding,
  createSelfUse,
  deleteChange,
  deleteCollection,
  deleteFeeding,
  deleteSelfUse,
  listChanges,
  listCollections,
  listFeedings,
  listSelfUse,
  updateChange,
  updateCollection,
  updateFeeding,
  updateSelfUse,
} from '../../api/layers'
import type { EggCollection, EggSelfUse, LayFlockChange, LayFeeding } from '../../api/types'
import { listFeedBrands, listFeedCategories } from '../../api/dictionaries'
import { DateInput, Select, TextInput } from '../../components/ui'
import { EventSection } from '../broiler/eventSections'

function today() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

interface SectionProps {
  flockId: number
  onChanged: () => void
}

// --- Изменения поголовья ---

export function ChangeSection({ flockId, onChanged }: SectionProps) {
  const [items, setItems] = useState<LayFlockChange[]>([])
  const reload = useCallback(async () => {
    setItems(await listChanges(flockId))
  }, [flockId])
  useEffect(() => {
    void reload()
  }, [reload])

  const [date, setDate] = useState(today())
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')

  return (
    <EventSection<LayFlockChange>
      title="Изменения поголовья"
      items={[...items].reverse()}
      renderRow={(c) =>
        `${c.date} — ${c.head_delta > 0 ? `+${c.head_delta}` : c.head_delta} гол${c.reason ? ` · ${c.reason}` : ''}`}
      toForm={(c) => {
        setDate(c.date)
        setDelta(String(c.head_delta))
        setReason(c.reason ?? '')
      }}
      onCreate={async (payload: never) => {
        await createChange(flockId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateChange(flockId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteChange(flockId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <ChangeFields
          date={date} setDate={setDate} delta={delta} setDelta={setDelta}
          reason={reason} setReason={setReason} onPayload={onPayload}
        />
      )}
    />
  )
}

function ChangeFields({ date, setDate, delta, setDelta, reason, setReason, onPayload }: {
  date: string; setDate: (v: string) => void
  delta: string; setDelta: (v: string) => void
  reason: string; setReason: (v: string) => void
  onPayload: (v: unknown) => void
}) {
  useEffect(() => {
    onPayload({ date, head_delta: Number(delta), reason: reason.trim() || null })
  }, [date, delta, reason, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <TextInput
        value={delta}
        onChange={setDelta}
        placeholder="+30 пополнение / −5 выбраковка"
        required
      />
      <TextInput value={reason} onChange={setReason} placeholder="Причина (необязательно)" />
    </>
  )
}

// --- Сбор яйца ---

export function CollectionSection({ flockId, onChanged }: SectionProps) {
  const [items, setItems] = useState<EggCollection[]>([])
  const reload = useCallback(async () => {
    setItems(await listCollections(flockId))
  }, [flockId])
  useEffect(() => {
    void reload()
  }, [reload])

  const [date, setDate] = useState(today())
  const [pieces, setPieces] = useState('')

  return (
    <EventSection<EggCollection>
      title="Сбор яйца"
      items={items}
      renderRow={(c) => `${c.date} — ${c.pieces} шт`}
      toForm={(c) => {
        setDate(c.date)
        setPieces(String(c.pieces))
      }}
      onCreate={async (payload: never) => {
        await createCollection(flockId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateCollection(flockId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteCollection(flockId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <PiecesFields
          date={date} setDate={setDate} pieces={pieces} setPieces={setPieces}
          placeholder="Штук собрано" onPayload={onPayload}
        />
      )}
    />
  )
}

// --- Самопотребление ---

export function SelfUseSection({ flockId, onChanged }: SectionProps) {
  const [items, setItems] = useState<EggSelfUse[]>([])
  const reload = useCallback(async () => {
    setItems(await listSelfUse(flockId))
  }, [flockId])
  useEffect(() => {
    void reload()
  }, [reload])

  const [date, setDate] = useState(today())
  const [pieces, setPieces] = useState('')

  return (
    <EventSection<EggSelfUse>
      title="Самопотребление"
      items={items}
      renderRow={(s) => `${s.date} — ${s.pieces} шт`}
      toForm={(s) => {
        setDate(s.date)
        setPieces(String(s.pieces))
      }}
      onCreate={async (payload: never) => {
        await createSelfUse(flockId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateSelfUse(flockId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteSelfUse(flockId, id)
        onChanged()
        await reload()
      }}
      form={(onPayload) => (
        <PiecesFields
          date={date} setDate={setDate} pieces={pieces} setPieces={setPieces}
          placeholder="Штук съели" onPayload={onPayload}
        />
      )}
    />
  )
}

function PiecesFields({ date, setDate, pieces, setPieces, placeholder, onPayload }: {
  date: string; setDate: (v: string) => void
  pieces: string; setPieces: (v: string) => void
  placeholder: string
  onPayload: (v: unknown) => void
}) {
  useEffect(() => {
    onPayload({ date, pieces: Number(pieces) })
  }, [date, pieces, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <TextInput value={pieces} onChange={setPieces} placeholder={placeholder} required />
    </>
  )
}

// --- Кормление ---

export function LayFeedingSection({ flockId, onChanged }: SectionProps) {
  const [items, setItems] = useState<LayFeeding[]>([])
  const [cats, setCats] = useState<{ id: number; name: string }[]>([])
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([])
  const reload = useCallback(async () => {
    setItems(await listFeedings(flockId))
  }, [flockId])
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
    <EventSection<LayFeeding>
      title="Кормление"
      items={items}
      renderRow={(f) => `${f.date} — ${catName(f.feed_category_id)} / ${brandName(f.feed_brand_id)} · ${f.kg} кг`}
      toForm={(f) => {
        setDate(f.date)
        setCat(String(f.feed_category_id))
        setBrand(String(f.feed_brand_id))
        setKg(String(f.kg))
      }}
      onCreate={async (payload: never) => {
        await createFeeding(flockId, payload)
        await reload()
        onChanged()
      }}
      onUpdate={async (id: number, payload: never) => {
        await updateFeeding(flockId, id, payload)
        await reload()
        onChanged()
      }}
      onDelete={async (id: number) => {
        await deleteFeeding(flockId, id)
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
    onPayload({
      date,
      feed_category_id: Number(cat),
      feed_brand_id: Number(brand),
      kg: Number(kg.replace(',', '.')),
    })
  }, [date, cat, brand, kg, onPayload])
  return (
    <>
      <DateInput value={date} onChange={setDate} required />
      <Select value={cat} onChange={setCat} options={cats.map((c) => ({ value: c.id.toString(), label: c.name }))} />
      <Select value={brand} onChange={setBrand} options={brands.map((b) => ({ value: b.id.toString(), label: b.name }))} />
      <TextInput value={kg} onChange={setKg} placeholder="Кг (можно с запятой)" required />
    </>
  )
}
