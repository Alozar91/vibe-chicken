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
  lat: number | null
  lon: number | null
}

export interface ProductType {
  id: number
  name: string
  unit: string
  /** цена по умолчанию за единицу вида (₽/шт или ₽/кг) */
  sale_price: number | null
}

/** Справочник цен для кнопки «Цена из справочника» в формах продаж. */
export interface Prices {
  egg_price_per_ten: number | null
  products: { id: number; name: string; unit: string; price: number | null }[]
}

export type MoneyKind = 'income' | 'expense'

export interface MoneyCategory {
  id: number
  name: string
  kind: MoneyKind
  is_active: boolean
  is_general?: boolean
}

export interface MoneyTransaction {
  id: number
  date: string
  money_category_id: number
  category_name: string
  kind: MoneyKind
  amount: number
  description: string | null
  batch_id: number | null
  flock_id: number | null
  is_auto: boolean
  source_type: string | null
}

export interface MoneySummary {
  income: number
  expense: number
  balance: number
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
  /** возраст при поступлении, дней (1 = суточные, §4.1) */
  arrival_age_days: number
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
  shared_costs: number
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

export interface AppSetting {
  key: string
  value: string
  default: string
  label: string
  hint: string
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

// --- Несушки и яйцо ---

export interface LayFlock {
  id: number
  name: string
  place_id: number
  start_date: string
  status: 'active' | 'closed'
}

export interface LayFlockChange {
  id: number
  flock_id: number
  date: string
  head_delta: number
  reason: string | null
}

export interface EggCollection {
  id: number
  flock_id: number
  date: string
  pieces: number
}

export interface EggSale {
  id: number
  date: string
  dozens: number
  price_per_ten: number
  buyer_id: number | null
  total_amount: number
}

export interface EggSelfUse {
  id: number
  flock_id: number
  date: string
  pieces: number
}

export interface LayFeeding {
  id: number
  flock_id: number
  date: string
  feed_category_id: number
  feed_brand_id: number
  kg: number
}

export interface FlockMetrics {
  current_head: number
  eggs_total: number
  dozens_sold: number
  egg_revenue: number
  selfuse_total: number
  feed_kg: number
  lay_rate_pct: number | null
}

// --- Отчёты ---

export interface MonthPoint {
  month: string // YYYY-MM
  income: number
  expense: number
  balance: number
}

export interface CategorySlice {
  category_id: number
  name: string
  kind: 'income' | 'expense'
  total: number
}

export interface EggMonthPoint {
  month: string
  collected: number
  selfused: number
  dozens_sold: number
  revenue: number
}

export interface BuyerRow {
  buyer_id: number | null
  name: string
  broiler_kg: number
  broiler_amount: number
  egg_dozens: number
  egg_amount: number
  total: number
}

export interface BatchRow {
  id: number
  code: string
  place_name: string
  status: string
  start_date: string
  survival_pct: number | null
  fcr: number | null
  feed_kg: number
  feed_cost: number
  direct_costs: number
  shared_costs: number
  revenue: number
  profit: number | null
  profit_per_head: number | null
}

// --- Заказы покупателей (concept.md §4.7) ---

export type OrderStatus = 'new' | 'done' | 'cancelled'

export interface Order {
  id: number
  date: string
  buyer: Buyer
  status: OrderStatus
  closed_manually: boolean
  comment: string | null
  created_at: string
  items: OrderItem[]
}

export interface OrderItem {
  id: number
  kind: 'egg' | 'product'
  product_type_id: number | null
  qty: number
  unit: string
  price_per_unit: number | null
  product_type: ProductType | null
}

export interface OrderMetrics {
  item_id: number
  kind: string
  unit: string
  product_type_id: number | null
  product_type_name: string | null
  ordered_qty: number
  fulfilled_qty: number
  remaining_qty: number
  pct: number | null
}

export interface OrderFulfillment {
  id: number
  item_id: number
  sale_kind: string
  egg_sale_id: number | null
  batch_sale_id: number | null
  actual_qty: number
  unit: string
  created_at: string
  /** данные связанной продажи (яйцо или продукция партии) */
  sale_date: string
  price: number
  amount: number
}

export interface OrderDetail extends Order {
  fulfillments: OrderFulfillment[]
  metrics: OrderMetrics[]
}

export interface OrderItemPayload {
  kind: 'egg' | 'product'
  product_type_id: number | null
  qty: number
  price_per_unit: number | null
}

// --- Дашборд (GET /api/reports/dashboard) ---
export interface DashWeighing {
  date: string
  avg_weight_kg: number
}

export interface DashBatch {
  id: number
  code: string
  place_name: string
  start_date: string
  status: string
  heads_alive: number
  age_days: number | null
  last_weighing: DashWeighing | null
}

export interface DashOrderItem {
  kind: 'egg' | 'product'
  qty: number
  unit: string
}

export interface DashOrder {
  id: number
  date: string
  buyer_name: string
  status: string
  items: DashOrderItem[]
}

export interface Dashboard {
  month_income: number
  month_expense: number
  month_balance: number
  egg_collected: number
  egg_dozens_sold: number
  active_batches: number
  active_heads: number
  orders_open: number
  feed_stock_kg: number
  recent_batches: DashBatch[]
  recent_orders: DashOrder[]
}
