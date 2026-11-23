/** Покупатели: имя, телефон, адрес; форма в модальном окне. */

import { useEffect, useState } from 'react'
import { createBuyer, deleteBuyer, listBuyers, updateBuyer } from '../../api/dictionaries'
import type { Buyer } from '../../api/types'
import { Button, Card, ErrorBox, Modal, Page, TextInput } from '../../components/ui'

export default function BuyersPage() {
  const [items, setItems] = useState<Buyer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Buyer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listBuyers())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setPhone('')
    setAddress('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (b: Buyer) => {
    setEditing(b)
    setName(b.name)
    setPhone(b.phone ?? '')
    setAddress(b.address ?? '')
    setFormError(null)
    setModalOpen(true)
  }

  const close = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    const payload = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null }
    try {
      if (editing === null) await createBuyer(payload)
      else await updateBuyer(editing.id, payload)
      setItems(await listBuyers())
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
      await deleteBuyer(id)
      setItems(await listBuyers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Покупатели">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Список покупателей</h3>
          <Button onClick={openCreate}>Добавить</Button>
        </div>
        <ErrorBox message={error} />
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
              <Button kind="secondary" onClick={() => openEdit(b)}>
                Изменить
              </Button>
              <Button kind="danger" onClick={() => remove(b.id)} disabled={busy}>
                Удалить
              </Button>
            </div>
          </Card>
        ))}
        {!loading && items.length === 0 && <p className="text-sm text-slate-400">Пока пусто</p>}
      </div>

      <Modal
        open={modalOpen}
        title={editing === null ? 'Новый покупатель' : 'Изменить покупателя'}
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
          <TextInput value={name} onChange={setName} placeholder="Имя" required />
          <TextInput value={phone} onChange={setPhone} placeholder="Телефон" />
          <TextInput value={address} onChange={setAddress} placeholder="Адрес" />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
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
