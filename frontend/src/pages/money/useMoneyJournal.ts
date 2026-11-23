/** Общая логика журнала денег для ПК- и мобильной версии (вёрстка у каждой своя):
 *  загрузка с фильтром месяца, сводка, создание/правка/удаление ручных записей. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  moneySummary,
  updateTransaction,
} from '../../api/money'
import { listMoneyCategories } from '../../api/dictionaries'
import { listBatches } from '../../api/broiler'
import type { BroilerBatch, MoneyCategory, MoneySummary, MoneyTransaction } from '../../api/types'

export const SOURCE_LABELS: Record<string, string> = {
  chicks: 'закупка цыплят',
  treatment: 'лечение',
  sale: 'продажа',
  purchase: 'закупка корма',
}

const emptyForm = {
  date: '',
  kind: 'expense' as 'income' | 'expense',
  money_category_id: '',
  amount: '',
  description: '',
  batch_id: '',
}

export type MoneyForm = typeof emptyForm

export function useMoneyJournal() {
  const [items, setItems] = useState<MoneyTransaction[]>([])
  const [summary, setSummary] = useState<MoneySummary | null>(null)
  const [cats, setCats] = useState<MoneyCategory[]>([])
  const [batches, setBatches] = useState<BroilerBatch[]>([])
  const [month, setMonth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<MoneyForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const [txs, sum] = await Promise.all([
        listTransactions(m || undefined),
        moneySummary(m || undefined),
      ])
      setItems(txs)
      setSummary(sum)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(month)
  }, [load, month])

  useEffect(() => {
    void (async () => {
      try {
        const [cs, bs] = await Promise.all([listMoneyCategories(), listBatches()])
        setCats(cs.filter((c) => c.is_active))
        setBatches(bs)
      } catch {
        /* справочники — не критично */
      }
    })()
  }, [])

  const catsForKind = useMemo(
    () => cats.filter((c) => c.kind === form.kind),
    [cats, form.kind],
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (t: MoneyTransaction) => {
    setEditingId(t.id)
    setForm({
      date: t.date,
      kind: t.kind,
      money_category_id: String(t.money_category_id),
      amount: String(t.amount),
      description: t.description ?? '',
      batch_id: t.batch_id ? String(t.batch_id) : '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.date || !form.money_category_id || !form.amount.trim()) {
      setFormError('Заполните дату, категорию и сумму')
      return
    }
    const amount = Number(form.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Сумма должна быть числом больше 0')
      return
    }
    const payload = {
      date: form.date,
      money_category_id: Number(form.money_category_id),
      amount,
      description: form.description.trim() || null,
      batch_id: form.batch_id ? Number(form.batch_id) : null,
    }
    setBusy(true)
    try {
      if (editingId === null) await createTransaction(payload)
      else await updateTransaction(editingId, payload)
      setModalOpen(false)
      await load(month)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Удалить запись журнала?')) return
    setBusy(true)
    try {
      await deleteTransaction(id)
      await load(month)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return {
    items,
    summary,
    batches,
    month,
    setMonth,
    error,
    loading,
    modalOpen,
    setModalOpen,
    form,
    setForm,
    formError,
    busy,
    editingId,
    catsForKind,
    openCreate,
    openEdit,
    submit,
    remove,
    fmt,
  }
}
