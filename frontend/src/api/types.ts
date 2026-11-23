/** Типы справочников (зеркала Pydantic-схем бэкенда). */

export type PlaceKind = 'broiler_module' | 'lay_house'

export interface Place {
  id: number
  name: string
  kind: PlaceKind
  note: string | null
}

export interface FeedCategory {
  id: number
  name: string
}

export interface FeedBrand {
  id: number
  name: string
}

export type VendorType = 'chicks' | 'feed' | 'meds' | 'other'

export interface Vendor {
  id: number
  name: string
  note: string | null
  types: VendorType[]
}

export interface Buyer {
  id: number
  name: string
  phone: string | null
  address: string | null
}

export interface ProductType {
  id: number
  name: string
}

export type MoneyKind = 'income' | 'expense'

export interface MoneyCategory {
  id: number
  name: string
  kind: MoneyKind
  is_active: boolean
}

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  chicks: 'Цыплята',
  feed: 'Корм',
  meds: 'Лекарства',
  other: 'Прочее',
}

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  broiler_module: 'Бройлерный модуль',
  lay_house: 'Курятник несушек',
}

export const MONEY_KIND_LABELS: Record<MoneyKind, string> = {
  income: 'Доход',
  expense: 'Расход',
}

// --- Склад корма ---
export interface FeedStockRow {
  feed_category_id: number
  feed_brand_id: number
  feed_category_name: string
  feed_brand_name: string
  purchased_kg: number
  used_kg: number
  adjusted_kg: number
  stock_kg: number
}

export interface FeedPurchase {
  id: number
  date: string
  feed_category_id: number
  feed_brand_id: number
  vendor_id: number
  kg: number
  total_cost: number
  comment: string | null
}

export interface FeedAdjustment {
  id: number
  date: string
  feed_category_id: number
  feed_brand_id: number
  kg_delta: number
  comment: string | null
}
