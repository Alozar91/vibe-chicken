/** API-клиент заказов покупателей (concept.md §4.7). */

import { api } from './client'
import type { Order, OrderDetail, OrderItemPayload, OrderStatus } from './types'

export const listOrders = () => api<Order[]>('/api/orders')

export const getOrder = (id: number) => api<OrderDetail>(`/api/orders/${id}`)

export const createOrder = (data: {
  date: string
  buyer_id: number
  comment: string | null
  items: OrderItemPayload[]
}) => api<Order>('/api/orders', { method: 'POST', body: JSON.stringify(data) })

export const updateOrder = (id: number, data: unknown) =>
  api<Order>(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteOrder = (id: number) => api<void>(`/api/orders/${id}`, { method: 'DELETE' })

export const setOrderStatus = (id: number, status: OrderStatus) =>
  api<Order>(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })

/** Продажа яйца из заказа (позиция kind='egg'); десятки и цена — факт. */
export const createEggFulfillment = (orderId: number, itemId: number, data: unknown) =>
  api<unknown>(`/api/orders/${orderId}/items/${itemId}/egg-sale`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

/** Продажа продукции партии из заказа (позиция kind='product'). */
export const createProductFulfillment = (
  orderId: number,
  itemId: number,
  batchId: number,
  data: unknown,
  actualPieces?: number | null,
) => {
  const q = actualPieces != null ? `?actual_pieces=${actualPieces}` : ''
  return api<unknown>(`/api/orders/${orderId}/items/${itemId}/product-sale?batch_id=${batchId}${q}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** Удалить продажу, созданную из заказа (вместе со связью). */
export const deleteFulfillment = (orderId: number, fId: number) =>
  api<void>(`/api/orders/${orderId}/fulfillments/${fId}`, { method: 'DELETE' })

/** Средний вес тушки по всем забоям (для пересчёта шт → кг). */
export const carcassWeight = () => api<{ avg_kg: number | null }>('/api/orders/carcass-weight')
