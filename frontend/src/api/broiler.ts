/** API-клиент партий бройлеров. */

import { api } from './client'
import type {
  BatchMetrics,
  BatchSale,
  BroilerBatch,
  Feeding,
  Mortality,
  Slaughter,
  Treatment,
  Weighing,
} from './types'

export const listBatches = () => api<BroilerBatch[]>('/api/batches')
export const createBatch = (data: Omit<BroilerBatch, 'id' | 'status' | 'closed_at'>) =>
  api<BroilerBatch>('/api/batches', { method: 'POST', body: JSON.stringify(data) })
export const closeBatch = (id: number) =>
  api<BroilerBatch>(`/api/batches/${id}/close`, { method: 'POST' })
export const batchMetrics = (id: number) => api<BatchMetrics>(`/api/batches/${id}/metrics`)

// события
const ev = (batchId: number, kind: string) => `/api/batches/${batchId}/${kind}`

export const listMortalities = (b: number) => api<Mortality[]>(ev(b, 'mortalities'))
export const createMortality = (b: number, data: Omit<Mortality, 'id' | 'batch_id'>) =>
  api<Mortality>(ev(b, 'mortalities'), { method: 'POST', body: JSON.stringify(data) })
export const deleteMortality = (b: number, id: number) =>
  api<void>(`${ev(b, 'mortalities')}/${id}`, { method: 'DELETE' })

export const listFeedings = (b: number) => api<Feeding[]>(ev(b, 'feedings'))
export const createFeeding = (b: number, data: Omit<Feeding, 'id' | 'batch_id'>) =>
  api<Feeding>(ev(b, 'feedings'), { method: 'POST', body: JSON.stringify(data) })
export const deleteFeeding = (b: number, id: number) =>
  api<void>(`${ev(b, 'feedings')}/${id}`, { method: 'DELETE' })

export const listWeighings = (b: number) => api<Weighing[]>(ev(b, 'weighings'))
export const createWeighing = (b: number, data: Omit<Weighing, 'id' | 'batch_id'>) =>
  api<Weighing>(ev(b, 'weighings'), { method: 'POST', body: JSON.stringify(data) })
export const deleteWeighing = (b: number, id: number) =>
  api<void>(`${ev(b, 'weighings')}/${id}`, { method: 'DELETE' })

export const listTreatments = (b: number) => api<Treatment[]>(ev(b, 'treatments'))
export const createTreatment = (b: number, data: Omit<Treatment, 'id' | 'batch_id'>) =>
  api<Treatment>(ev(b, 'treatments'), { method: 'POST', body: JSON.stringify(data) })
export const deleteTreatment = (b: number, id: number) =>
  api<void>(`${ev(b, 'treatments')}/${id}`, { method: 'DELETE' })

export const listSlaughters = (b: number) => api<Slaughter[]>(ev(b, 'slaughters'))
export const createSlaughter = (
  b: number,
  data: { date: string; head_count: number; outputs: { product_type_id: number; kg: number }[] },
) => api<Slaughter>(ev(b, 'slaughters'), { method: 'POST', body: JSON.stringify(data) })
export const deleteSlaughter = (b: number, id: number) =>
  api<void>(`${ev(b, 'slaughters')}/${id}`, { method: 'DELETE' })

export const listSales = (b: number) => api<BatchSale[]>(ev(b, 'sales'))
export const createSale = (
  b: number,
  data: { date: string; product_type_id: number; product_kg: number; price_per_kg: number; buyer_id: number | null; total_amount: number | null },
) =>
  api<BatchSale>(ev(b, 'sales'), { method: 'POST', body: JSON.stringify(data) })
export const deleteSale = (b: number, id: number) =>
  api<void>(`${ev(b, 'sales')}/${id}`, { method: 'DELETE' })
