/** Покупатели: имя, телефон, адрес. */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { createBuyer, deleteBuyer, listBuyers, updateBuyer } from '../../api/dictionaries'
import type { Buyer } from '../../api/types'
import { Button, Card, ErrorBox, TextInput } from '../../components/ui'
import { Page } from '../../components/ui'

export default function BuyersPage() {
  const [items, setItems] = useState<Buyer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      setItems(await listBuyers())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  void refresh()

  const payload = () => ({
    name: name.trim(),
    phone: phone.trim() || null,
    address: address.trim() || null,
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (editingId === null) await createBuyer(payload())
      else await updateBuyer(editingId, payload())
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
      await deleteBuyer(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (b: Buyer) => {
    setEditingId(b.id)
    setName(b.name)
    setPhone(b.phone ?? '')
    setAddress(b.address ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName('')
    setPhone('')
    setAddress('')
  }

  return (
    <Page title="Покупатели">
      <Card>
        <h3 className="font-semibold text-slate-900">
          {editingId === null ? 'Новый покупатель' : 'Редактирование'}
        </h3>
        <ErrorBox message={error} />
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextInput value={name} onChange={setName} placeholder="Имя" required />
            <TextInput value={phone} onChange={setPhone} placeholder="Телефон" />
            <TextInput value={address} onChange={setAddress} placeholder="Адрес" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
        {items.map((b) => (
          <Card key={b.id} className="!p-4">
            <div className="font-medium text-slate-900">{b.name}</div>
            {b.phone && (
              <a href={`tel:${b.phone}`} className="text-sm text-amber-600">
                {b.phone}
              </a>
            )}
            {b.address && <p className="text-sm text-slate-500">{b.address}</p>}
            <div className="mt-2 flex gap-2">
              <Button kind="secondary" onClick={() => startEdit(b)}>
                Изменить
              </Button>
              <Button kind="danger" onClick={() => remove(b.id)} disabled={busy}>
                Удалить
              </Button>
            </div>
          </Card>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400">Пока пусто</p>
        )}
      </div>
    </Page>
  )
}
