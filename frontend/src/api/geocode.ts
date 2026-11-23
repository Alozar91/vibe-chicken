/** API геокодирования: адрес → координаты (Nominatim на бэкенде). */

import { api } from './client'

export interface GeoPoint {
  lat: number
  lon: number
  label: string
}

export const geocodeAddress = (query: string) =>
  api<GeoPoint>(`/api/geocode?q=${encodeURIComponent(query)}`, { method: 'POST' })
