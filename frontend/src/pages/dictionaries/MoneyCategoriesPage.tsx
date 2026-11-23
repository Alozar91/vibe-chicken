/** Категории денег: доход/расход, деактивация вместо удаления; форма в модалке. */

import { useEffect, useState } from 'react'
import {
  createMoneyCategory,
  deactivateMoneyCategory,
  listMoneyCategories,
  MONEY_KINDS,
  updateMoneyCategory,
} from '../../api/dictionaries'
import type { MoneyCategory, MoneyKind } from '../../api/types'
import { Button, Card, ErrorBox, Modal, Page, Select, TextInput } from '../../components/ui'

const KIND_STYLES: Record<MoneyKind, string> = {
  income: 'bg-green-100 text-green-700',
  expense: 'bg-red-100 text-red-700',
}

export default function MoneyCategoriesPage() {
  const [items, setItems] = useState<MoneyCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MoneyCategory | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<MoneyKind>('expense')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listMoneyCategories())
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
    setKind('expense')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (m: MoneyCategory) => {
    setEditing(m)
    setName(m.name)
    setKind(m.kind)
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
    try {
      if (editing === null) await createMoneyCategory(name.trim(), kind)
      else await updateMoneyCategory(editing.id, name.trim(), kind)
      setItems(await listMoneyCategories())
      setError(null)
      close()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async (id: number) => {
    setBusy(true)
    try {
      await deactivateMoneyCategory(id)
      setItems(await listMoneyCategories())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Категории денег">
      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Список категорий</h3>
          <Button onClick={openCreate}>Добавить</Button>
        </div>
        <ErrorBox message={error} />
        <p className="mt-1 text-xs text-slate-400">
          Категории не удаляются, а выключаются — журнал денег ссылается на них.
        </p>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
        {items.map((m) => (
          <Card key={m.id} className={`!p-4 ${!m.is_active ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{m.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${KIND_STYLES[m.kind]}`}>
                {m.kind === 'income' ? 'Доход' : 'Расход'}
              </span>
              {!m.is_active && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                  выключена
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Button kind="secondary" onClick={() => openEdit(m)}>
                Изменить
              </Button>
              {m.is_active && (
                <Button kind="danger" onClick={() => deactivate(m.id)} disabled={busy}>
                  Выключить
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!loading && items.length === 0 && (
          <p className="text-sm text-slate-400">Пока пусто — добавьте категории для журнала</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing === null ? 'Новая категория' : 'Изменить категорию'}
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
          <TextInput value={name} onChange={setName} placeholder="Например: Корм" required />
          <div className="w-full sm:w-56">
            <Select value={kind} onChange={setKind} options={MONEY_KINDS} />
          </div>
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
