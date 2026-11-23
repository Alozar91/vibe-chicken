/** Продавцы: обязательные теги-типы, чекбоксы, форма в модальном окне. */

import { useEffect, useState } from 'react'
import { createVendor, deleteVendor, listVendors, updateVendor, VENDOR_TYPES } from '../../api/dictionaries'
import type { Vendor, VendorType } from '../../api/types'
import { Button, Card, Checkbox, ErrorBox, Modal, Page, TextInput } from '../../components/ui'

export default function VendorsPage() {
  const [items, setItems] = useState<Vendor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [types, setTypes] = useState<Set<VendorType>>(new Set(['other']))
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listVendors())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleType = (t: VendorType) => {
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const openCreate = () => {
    setEditing(null)
    setName('')
    setNote('')
    setTypes(new Set(['other']))
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (v: Vendor) => {
    setEditing(v)
    setName(v.name)
    setNote(v.note ?? '')
    setTypes(new Set(v.types))
    setFormError(null)
    setModalOpen(true)
  }

  const close = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const submit = async () => {
    if (!name.trim() || types.size === 0) {
      setFormError('Укажите название и хотя бы один тип')
      return
    }
    setBusy(true)
    const payload = { name: name.trim(), note: note.trim() || null, types: [...types] }
    try {
      if (editing === null) await createVendor(payload)
      else await updateVendor(editing.id, payload)
      setItems(await listVendors())
      setError(null)
      close()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await deleteVendor(id)
      setItems(await listVendors())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Продавцы">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Список продавцов</h3>
          <Button onClick={openCreate}>Добавить</Button>
        </div>
        <ErrorBox message={error} />
        <p className="mt-1 text-xs text-slate-400">
          Теги определяют, какие операции разрешены с этим продавцом (цыплята / корм / лекарства / прочее).
        </p>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
        {items.map((v) => (
          <Card key={v.id} className="!p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{v.name}</span>
              {v.types.map((t) => (
                <span key={t} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  {VENDOR_TYPES.find((x) => x.value === t)?.label}
                </span>
              ))}
            </div>
            {v.note && <p className="mt-1 text-sm text-slate-500">{v.note}</p>}
            <div className="mt-2 flex gap-2">
              <Button kind="secondary" onClick={() => openEdit(v)}>
                Изменить
              </Button>
              <Button kind="danger" onClick={() => remove(v.id)} disabled={busy}>
                Удалить
              </Button>
            </div>
          </Card>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400">Пока пусто — добавьте первого продавца</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing === null ? 'Новый продавец' : 'Изменить продавца'}
        onClose={close}
      >
        <ErrorBox message={formError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          <TextInput value={name} onChange={setName} placeholder="Название" required />
          <TextInput value={note} onChange={setNote} placeholder="Примечание (необязательно)" />
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Типы (хотя бы один):</p>
            <div className="flex flex-wrap gap-4">
              {VENDOR_TYPES.map((t) => (
                <Checkbox
                  key={t.value}
                  checked={types.has(t.value)}
                  onChange={() => toggleType(t.value)}
                  label={t.label}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy || types.size === 0}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={close}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
