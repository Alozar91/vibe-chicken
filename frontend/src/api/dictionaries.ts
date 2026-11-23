/** API-клиент справочников. Весь fetch — здесь, компоненты его не повторяют. */

import { api } from './client'
import type {
  Buyer,
  FeedBrand,
  FeedCategory,
  MoneyCategory,
  MoneyKind,
  Place,
  PlaceKind,
  ProductType,
  Prices,
  Vendor,
  VendorType,
} from './types'

// --- Места содержания ---
export const listPlaces = () => api<Place[]>('/api/dictionaries/places')
export const createPlace = (data: Omit<Place, 'id'>) =>
  api<Place>('/api/dictionaries/places', { method: 'POST', body: JSON.stringify(data) })
export const updatePlace = (id: number, data: Omit<Place, 'id'>) =>
  api<Place>(`/api/dictionaries/places/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deletePlace = (id: number) =>
  api<void>(`/api/dictionaries/places/${id}`, { method: 'DELETE' })

// --- Категории корма ---
export const listFeedCategories = () => api<FeedCategory[]>('/api/dictionaries/feed-categories')
export const createFeedCategory = (name: string) =>
  api<FeedCategory>('/api/dictionaries/feed-categories', { method: 'POST', body: JSON.stringify({ name }) })
export const updateFeedCategory = (id: number, name: string) =>
  api<FeedCategory>(`/api/dictionaries/feed-categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
export const deleteFeedCategory = (id: number) =>
  api<void>(`/api/dictionaries/feed-categories/${id}`, { method: 'DELETE' })

// --- Производители корма ---
export const listFeedBrands = () => api<FeedBrand[]>('/api/dictionaries/feed-brands')
export const createFeedBrand = (name: string) =>
  api<FeedBrand>('/api/dictionaries/feed-brands', { method: 'POST', body: JSON.stringify({ name }) })
export const updateFeedBrand = (id: number, name: string) =>
  api<FeedBrand>(`/api/dictionaries/feed-brands/${id}`, { method: 'PUT', body: JSON.stringify({ name }) })
export const deleteFeedBrand = (id: number) =>
  api<void>(`/api/dictionaries/feed-brands/${id}`, { method: 'DELETE' })

// --- Продавцы ---
export const listVendors = (vendorType?: VendorType) =>
  api<Vendor[]>('/api/dictionaries/vendors' + (vendorType ? `?vendor_type=${vendorType}` : ''))
export const createVendor = (data: Omit<Vendor, 'id'>) =>
  api<Vendor>('/api/dictionaries/vendors', { method: 'POST', body: JSON.stringify(data) })
export const updateVendor = (id: number, data: Omit<Vendor, 'id'>) =>
  api<Vendor>(`/api/dictionaries/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteVendor = (id: number) =>
  api<void>(`/api/dictionaries/vendors/${id}`, { method: 'DELETE' })

// --- Покупатели ---
export const listBuyers = () => api<Buyer[]>('/api/dictionaries/buyers')
export const createBuyer = (data: Omit<Buyer, 'id'>) =>
  api<Buyer>('/api/dictionaries/buyers', { method: 'POST', body: JSON.stringify(data) })
export const updateBuyer = (id: number, data: Omit<Buyer, 'id'>) =>
  api<Buyer>(`/api/dictionaries/buyers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteBuyer = (id: number) =>
  api<void>(`/api/dictionaries/buyers/${id}`, { method: 'DELETE' })

// --- Виды продукции ---
export const listProductTypes = () => api<ProductType[]>('/api/dictionaries/product-types')
export const createProductType = (name: string, unit: string, salePrice: number | null) =>
  api<ProductType>('/api/dictionaries/product-types', {
    method: 'POST',
    body: JSON.stringify({ name, unit, sale_price: salePrice }),
  })
export const updateProductType = (id: number, name: string, unit: string, salePrice: number | null) =>
  api<ProductType>(`/api/dictionaries/product-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, unit, sale_price: salePrice }),
  })

/** Справочник цен: яйцо (₽/дес) + виды продукции (₽/шт или ₽/кг). */
export const getPrices = () => api<Prices>('/api/dictionaries/prices')
export const deleteProductType = (id: number) =>
  api<void>(`/api/dictionaries/product-types/${id}`, { method: 'DELETE' })

// --- Категории денег ---
export const listMoneyCategories = () => api<MoneyCategory[]>('/api/dictionaries/money-categories')
export const createMoneyCategory = (name: string, kind: MoneyKind, isGeneral = false) =>
  api<MoneyCategory>('/api/dictionaries/money-categories', {
    method: 'POST',
    body: JSON.stringify({ name, kind, is_general: isGeneral }),
  })
export const updateMoneyCategory = (id: number, name: string, kind: MoneyKind, isGeneral = false) =>
  api<MoneyCategory>(`/api/dictionaries/money-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, kind, is_general: isGeneral }),
  })
export const deactivateMoneyCategory = (id: number) =>
  api<void>(`/api/dictionaries/money-categories/${id}`, { method: 'DELETE' })

// Собираем все справочники одной загрузкой для страниц
export interface AllDictionaries {
  places: Place[]
  feedCategories: FeedCategory[]
  feedBrands: FeedBrand[]
  vendors: Vendor[]
  buyers: Buyer[]
  productTypes: ProductType[]
  moneyCategories: MoneyCategory[]
}

export async function loadAll(): Promise<AllDictionaries> {
  const [places, feedCategories, feedBrands, vendors, buyers, productTypes, moneyCategories] =
    await Promise.all([
      listPlaces(),
      listFeedCategories(),
      listFeedBrands(),
      listVendors(),
      listBuyers(),
      listProductTypes(),
      listMoneyCategories(),
    ])
  return { places, feedCategories, feedBrands, vendors, buyers, productTypes, moneyCategories }
}

// Перечисления для выпадающих списков (значения бэкенда)
export const PLACE_KINDS: { value: PlaceKind; label: string }[] = [
  { value: 'broiler_module', label: 'Бройлерный модуль' },
  { value: 'lay_house', label: 'Курятник несушек' },
]

export const VENDOR_TYPES: { value: VendorType; label: string }[] = [
  { value: 'chicks', label: 'Цыплята' },
  { value: 'feed', label: 'Корм' },
  { value: 'meds', label: 'Лекарства' },
  { value: 'other', label: 'Прочее' },
]

export const MONEY_KINDS: { value: MoneyKind; label: string }[] = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
]
