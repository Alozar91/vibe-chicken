/** API маршрутов доставки (§4.8): предпросмотр + CRUD поездок. */

import { api } from './client'
import type { PreviewOut, RouteDetail, RouteSummary } from './types'

export const previewRoute = (orderIds: number[]) =>
  api<PreviewOut>(`/api/routes/preview?order_ids=${orderIds.join(',')}`)

export const listRoutes = () => api<RouteSummary[]>('/api/routes')

export const getRoute = (id: number) => api<RouteDetail>(`/api/routes/${id}`)

export const createRoute = (data: { name?: string; stops: unknown[] }) =>
  api<RouteSummary>('/api/routes', { method: 'POST', body: JSON.stringify(data) })

export const updateRoute = (id: number, data: { name?: string; stops: unknown[] }) =>
  api<RouteSummary>(`/api/routes/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteRoute = (id: number) =>
  api<void>(`/api/routes/${id}`, { method: 'DELETE' })

/** Ссылка «Открыть в Яндекс Картах» с промежуточными точками. */
export function yandexMapsUrl(
  farm: { lat: number; lon: number } | null,
  stops: { lat: number; lon: number }[],
): string {
  const pts: string[] = []
  if (farm) pts.push(`${farm.lat},${farm.lon}`)
  for (const s of stops) pts.push(`${s.lat},${s.lon}`)
  return `https://yandex.ru/maps/?rtext=${pts.join('~')}&rtt=auto`
}
