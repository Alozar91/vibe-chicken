/** Журнал денег: авто-записи событий (только чтение) + ручные доходы/расходы.
 *  Общие расходы — ручные записи в категориях с флагом «общая»; они распределяются
 *  по кура-дням между партиями (доля показывается на карточке партии). */

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
import { Button, Card, DateInput, ErrorBox, Modal, Page, Select, TextInput } from '../../components/ui'

const SOURCE_LABELS: Record<string, string> = {
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

export default function MoneyPage() {
  const [items, setItems] = useState<MoneyTransaction[]>([])
  const [summary, setSummary] = useState<MoneySummary | null>(null)
  const [cats, setCats] = useState<MoneyCategory[]>([])
  const [batches, setBatches] = useState<BroilerBatch[]>([])
  const [month, setMonth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
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

  return (
    <Page title="Журнал денег">
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400">Доходы</p>
          <p className="text-base font-semibold text-green-600 sm:text-lg">
            {summary ? `+ ${fmt(summary.income)} ₽` : '…'}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400">Расходы</p>
          <p className="text-base font-semibold text-red-600 sm:text-lg">
            {summary ? `− ${fmt(summary.expense)} ₽` : '…'}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400">Баланс</p>
          <p className={`text-lg font-semibold ${summary && summary.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {summary ? `${fmt(summary.balance)} ₽` : '…'}
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">Записи</h3>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-base sm:text-sm"
            />
            {month && (
              <button onClick={() => setMonth('')} className="text-xs text-slate-400 hover:text-slate-600">
                сбросить
              </button>
            )}
          </div>
          <Button onClick={openCreate}>Добавить запись</Button>
        </div>
        <ErrorBox message={error} />
        <p className="mt-1 text-xs text-slate-400">
          🔒 — авто-записи от событий (закупка цыплят, корм, лечение, продажи): правятся в карточке партии или на складе.
          Ручные записи в «общих» категориях (электричество и т.п.) распределяются по кура-дням.
        </p>
      </Card>

      <Card className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">Записей пока нет</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-2">Дата</th>
                <th className="pb-2">Категория</th>
                <th className="pb-2">Описание</th>
                <th className="pb-2">Партия</th>
                <th className="pb-2 text-right">Сумма</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-2">
                    {t.category_name}
                    {t.is_auto && (
                      <span
                        title={t.source_type ? SOURCE_LABELS[t.source_type] ?? '' : ''}
                        className="ml-1 text-slate-400"
                      >
                        🔒
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">{t.description}</td>
                  <td className="py-2 pr-2 text-slate-500">
                    {t.batch_id && batches.find((b) => b.id === t.batch_id)?.code}
                  </td>
                  <td
                    className={`py-2 pr-2 text-right whitespace-nowrap font-medium ${
                      t.kind === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {t.kind === 'income' ? '+' : '−'} {fmt(t.amount)} ₽
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {t.is_auto ? (
                      <span className="text-xs text-slate-300">авто</span>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(t)}
                          className="mr-2 text-xs text-amber-600 hover:underline"
                        >
                          изменить
                        </button>
                        <button
                          onClick={() => void remove(t.id)}
                          disabled={busy}
                          className="text-xs text-red-500 hover:underline"
                        >
                          удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editingId === null ? 'Новая запись' : 'Изменить запись'}
        onClose={() => setModalOpen(false)}
      >
        <ErrorBox message={formError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          <div className="w-full sm:w-48">
            <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <Select
            value={form.kind}
            onChange={(v) =>
              setForm({ ...form, kind: v as 'income' | 'expense', money_category_id: '' })
            }
            options={[
              { value: 'expense', label: 'Расход' },
              { value: 'income', label: 'Доход' },
            ]}
          />
          <Select
            value={form.money_category_id}
            onChange={(v) => setForm({ ...form, money_category_id: v })}
            options={[
              { value: '', label: 'Категория…' },
              ...catsForKind.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
          <div className="w-full sm:w-48">
            <TextInput
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              placeholder="Сумма, ₽"
            />
          </div>
          <TextInput
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Описание (необязательно)"
          />
          <Select
            value={form.batch_id}
            onChange={(v) => setForm({ ...form, batch_id: v })}
            options={[
              { value: '', label: 'Без привязки (общий расход)' },
              ...batches
                .filter((b) => b.status === 'active')
                .map((b) => ({ value: String(b.id), label: b.code })),
            ]}
          />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
