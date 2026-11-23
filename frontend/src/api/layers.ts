/** API несушек и яйца. */

import { api } from './client'
import type {
  EggCollection,
  EggSale,
  EggSelfUse,
  FlockMetrics,
  LayFeeding,
  LayFlock,
  LayFlockChange,
} from './types'

const flock = (id: number, path = '') => `/api/flocks/${id}${path}`

// стада
export const listFlocks = () => api<LayFlock[]>('/api/flocks')
export const getFlock = (id: number) => api<LayFlock>(flock(id))
export const createFlock = (data: { name: string; place_id: number; start_date: string }) =>
  api<LayFlock>('/api/flocks', { method: 'POST', body: JSON.stringify(data) })
export const updateFlock = (
  id: number,
  data: { name: string; place_id: number; start_date: string },
) => api<LayFlock>(flock(id), { method: 'PUT', body: JSON.stringify(data) })
export const closeFlock = (id: number) => api<LayFlock>(flock(id, '/close'), { method: 'POST' })
export const flockMetrics = (id: number) => api<FlockMetrics>(flock(id, '/metrics'))

// изменения поголовья
export const listChanges = (id: number) => api<LayFlockChange[]>(flock(id, '/changes'))
export const createChange = (
  id: number,
  data: { date: string; head_delta: number; reason: string | null },
) => api<LayFlockChange>(flock(id, '/changes'), { method: 'POST', body: JSON.stringify(data) })
export const updateChange = (
  id: number,
  objId: number,
  data: { date: string; head_delta: number; reason: string | null },
) => api<LayFlockChange>(flock(id, `/changes/${objId}`), { method: 'PUT', body: JSON.stringify(data) })
export const deleteChange = (id: number, objId: number) =>
  api<void>(flock(id, `/changes/${objId}`), { method: 'DELETE' })

// сбор яйца
export const listCollections = (id: number) => api<EggCollection[]>(flock(id, '/collections'))
export const createCollection = (id: number, data: { date: string; pieces: number }) =>
  api<EggCollection>(flock(id, '/collections'), { method: 'POST', body: JSON.stringify(data) })
export const updateCollection = (id: number, objId: number, data: { date: string; pieces: number }) =>
  api<EggCollection>(flock(id, `/collections/${objId}`), { method: 'PUT', body: JSON.stringify(data) })
export const deleteCollection = (id: number, objId: number) =>
  api<void>(flock(id, `/collections/${objId}`), { method: 'DELETE' })

// самопотребление
export const listSelfUse = (id: number) => api<EggSelfUse[]>(flock(id, '/selfuse'))
export const createSelfUse = (id: number, data: { date: string; pieces: number }) =>
  api<EggSelfUse>(flock(id, '/selfuse'), { method: 'POST', body: JSON.stringify(data) })
export const updateSelfUse = (id: number, objId: number, data: { date: string; pieces: number }) =>
  api<EggSelfUse>(flock(id, `/selfuse/${objId}`), { method: 'PUT', body: JSON.stringify(data) })
export const deleteSelfUse = (id: number, objId: number) =>
  api<void>(flock(id, `/selfuse/${objId}`), { method: 'DELETE' })

// кормление
export const listFeedings = (id: number) => api<LayFeeding[]>(flock(id, '/feedings'))
export const createFeeding = (
  id: number,
  data: { date: string; feed_category_id: number; feed_brand_id: number; kg: number },
) => api<LayFeeding>(flock(id, '/feedings'), { method: 'POST', body: JSON.stringify(data) })
export const updateFeeding = (
  id: number,
  objId: number,
  data: { date: string; feed_category_id: number; feed_brand_id: number; kg: number },
) => api<LayFeeding>(flock(id, `/feedings/${objId}`), { method: 'PUT', body: JSON.stringify(data) })
export const deleteFeeding = (id: number, objId: number) =>
  api<void>(flock(id, `/feedings/${objId}`), { method: 'DELETE' })

// продажи яйца (глобальные)
export const listEggSales = () => api<EggSale[]>('/api/egg-sales')
export const createEggSale = (data: {
  date: string
  dozens: number
  price_per_ten: number
  buyer_id: number | null
  total_amount: number | null
}) => api<EggSale>('/api/egg-sales', { method: 'POST', body: JSON.stringify(data) })
export const updateEggSale = (
  id: number,
  data: {
    date: string
    dozens: number
    price_per_ten: number
    buyer_id: number | null
    total_amount: number | null
  },
) => api<EggSale>(`/api/egg-sales/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteEggSale = (id: number) =>
  api<void>(`/api/egg-sales/${id}`, { method: 'DELETE' })
