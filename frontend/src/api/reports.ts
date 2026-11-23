/** API отчётов. */

import { api } from './client'
import type { BatchRow, BuyerRow, CategorySlice, Dashboard, EggMonthPoint, MonthPoint } from './types'

export const monthlyReport = (months = 12) =>
  api<MonthPoint[]>(`/api/reports/monthly?months=${months}`)
export const categoriesReport = (month: string | null) =>
  api<CategorySlice[]>(`/api/reports/categories${month ? `?month=${month}` : ''}`)
export const eggsReport = (months = 6) => api<EggMonthPoint[]>(`/api/reports/eggs?months=${months}`)
export const buyersReport = (months = 12) => api<BuyerRow[]>(`/api/reports/buyers?months=${months}`)
export const batchesReport = () => api<BatchRow[]>('/api/reports/batches')

export const getDashboard = () => api<Dashboard>('/api/reports/dashboard')
