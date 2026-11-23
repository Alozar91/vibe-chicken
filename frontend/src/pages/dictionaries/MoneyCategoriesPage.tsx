/** Категории денег: доход/расход, деактивация вместо удаления. */

import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  createMoneyCategory,
  deactivateMoneyCategory,
  listMoneyCategories,
  MONEY_KINDS,
  updateMoneyCategory,
} from '../../api/dictionaries'
import type { MoneyCategory, MoneyKind } from '../../api/types'
import { Button, Card, ErrorBox, Page, Select, TextInput } from '../../components/ui'

const KIND_STYLES: Record<MoneyKind, string> = {
  income: 'bg-green-100 text-green-700',
  expense: 'bg-red-100 text-red-700',
}

export default function MoneyCategoriesPage() {
  const [items, setItems] = useState<MoneyCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<MoneyKind>('expense')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      setItems(await listMoneyCategories())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  void refresh()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (editingId === null) await createMoneyCategory(name.trim(), kind)
      else await updateMoneyCategory(editingId, name.trim(), kind)
      await refresh()
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async (id: number) => {
    setBusy(true)
    try {
      await deactivateMoneyCategory(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (m: MoneyCategory) => {
    setEditingId(m.id)
    setName(m.name)
    setKind(m.kind)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName('')
    setKind('expense')
  }

  return (
    <Page title="Категории денег">
      <Card>
        <h3 className="font-semibold text-slate-900">
          {editingId === null ? 'Новая категория' : 'Редактирование'}
        </h3>
        <ErrorBox message={error} />
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <TextInput value={name} onChange={setName} placeholder="Например: Корм" required />
            <div className="w-full sm:w-44">
              <Select value={kind} onChange={setKind} options={MONEY_KINDS} />
            </div>
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
              <Button kind="secondary" onClick={() => startEdit(m)}>
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
    </Page>
  )
}
