/** API журнала денег: ручные записи + авто (только чтение), сводка. */

import { api } from './client'
import type { MoneySummary, MoneyTransaction } from './types'

export const listTransactions = (month?: string) =>
  api<MoneyTransaction[]>(`/api/money/transactions${month ? `?month=${month}` : ''}`)

export const moneySummary = (month?: string) =>
  api<MoneySummary>(`/api/money/summary${month ? `?month=${month}` : ''}`)

export const createTransaction = (data: {
  date: string
  money_category_id: number
  amount: number
  description: string | null
  batch_id: number | null
}) =>
  api<MoneyTransaction>('/api/money/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateTransaction = (
  id: number,
  data: {
    date: string
    money_category_id: number
    amount: number
    description: string | null
    batch_id: number | null
  },
) =>
  api<MoneyTransaction>(`/api/money/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteTransaction = (id: number) =>
  api<void>(`/api/money/transactions/${id}`, { method: 'DELETE' })
