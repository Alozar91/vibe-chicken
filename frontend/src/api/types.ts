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

// --- Партии бройлеров ---
export type BatchStatus = 'active' | 'closed'

export interface BroilerBatch {
  id: number
  code: string
  place_id: number
  start_date: string
  head_count: number
  cross: string | null
  vendor_id: number
  chick_price_per_head: number
  chick_avg_weight_kg: number | null
  status: BatchStatus
  closed_at: string | null
}

export interface BatchMetrics {
  current_head: number
  slaughtered_head: number
  dead_head: number
  survival_pct: number | null
  fcr: number | null
  feed_kg: number
  live_weight_kg: number
  output_kg: number
  output_pct: number | null
  direct_costs: number
  revenue: number
  profit: number | null
}

export interface Mortality {
  id: number
  batch_id: number
  date: string
  head_count: number
  cause: string | null
}

export interface Feeding {
  id: number
  batch_id: number
  date: string
  feed_category_id: number
  feed_brand_id: number
  kg: number
}

export interface Weighing {
  id: number
  batch_id: number
  date: string
  head_count: number
  avg_weight_kg: number
}

export interface Treatment {
  id: number
  batch_id: number
  date: string
  description: string
  cost: number
}

export interface SlaughterOutput {
  id: number
  product_type_id: number
  kg: number
  product_type_name: string | null
}

export interface Slaughter {
  id: number
  batch_id: number
  date: string
  head_count: number
  live_weight_kg: number
  outputs: SlaughterOutput[]
}

export interface BatchSale {
  id: number
  batch_id: number
  date: string
  product_type_id: number
  product_kg: number
  price_per_kg: number
  buyer_id: number | null
  total_amount: number
}
