/** API-клиент склада корма. */

import { api } from './client'
import type { FeedAdjustment, FeedPurchase, FeedStockRow } from './types'

export const stock = () => api<FeedStockRow[]>('/api/feed/stock')
export const listPurchases = () => api<FeedPurchase[]>('/api/feed/purchases')
export const createPurchase = (data: Omit<FeedPurchase, 'id'>) =>
  api<FeedPurchase>('/api/feed/purchases', { method: 'POST', body: JSON.stringify(data) })
export const deletePurchase = (id: number) =>
  api<void>(`/api/feed/purchases/${id}`, { method: 'DELETE' })

export const listAdjustments = () => api<FeedAdjustment[]>('/api/feed/adjustments')
export const createAdjustment = (data: Omit<FeedAdjustment, 'id'>) =>
  api<FeedAdjustment>('/api/feed/adjustments', { method: 'POST', body: JSON.stringify(data) })
export const deleteAdjustment = (id: number) =>
  api<void>(`/api/feed/adjustments/${id}`, { method: 'DELETE' })
