/** Продавцы: обязательные теги-типы, чекбоксы. Логика в useCrud. */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { createVendor, deleteVendor, listVendors, updateVendor, VENDOR_TYPES } from '../../api/dictionaries'
import type { Vendor, VendorType } from '../../api/types'
import { Button, Card, Checkbox, ErrorBox, TextInput } from '../../components/ui'
import { Page } from '../../components/ui'

export default function VendorsPage() {
  const [items, setItems] = useState<Vendor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [types, setTypes] = useState<Set<VendorType>>(new Set(['other']))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      setItems(await listVendors())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  void refresh()

  const toggleType = (t: VendorType) => {
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const payload = () => ({ name: name.trim(), note: note.trim() || null, types: [...types] })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || types.size === 0) {
      setError('Укажите название и хотя бы один тип')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editingId === null) await createVendor(payload())
      else await updateVendor(editingId, payload())
      await refresh()
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    setBusy(true)
    try {
      await deleteVendor(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (v: Vendor) => {
    setEditingId(v.id)
    setName(v.name)
    setNote(v.note ?? '')
    setTypes(new Set(v.types))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName('')
    setNote('')
    setTypes(new Set(['other']))
  }

  return (
    <Page title="Продавцы">
      <Card>
        <h3 className="font-semibold text-slate-900">
          {editingId === null ? 'Новый продавец' : 'Редактирование'}
        </h3>
        <ErrorBox message={error} />
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput value={name} onChange={setName} placeholder="Название" required />
            <TextInput value={note} onChange={setNote} placeholder="Примечание (необязательно)" />
          </div>
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
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || types.size === 0}>
              {editingId === null ? 'Добавить' : 'Сохранить'}
            </Button>
            {editingId !== null && (
              <Button kind="secondary" onClick={cancelEdit}>
                Отмена
              </Button>
            )}
          </div>
        </form>
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
              <Button kind="secondary" onClick={() => startEdit(v)}>
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
    </Page>
  )
}
