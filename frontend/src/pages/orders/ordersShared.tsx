/** Общие элементы страниц заказов: бейдж статуса, подписи единиц. */

import type { OrderStatus } from '../../api/types'

export function statusLabel(s: OrderStatus): string {
  return s === 'new' ? 'Новый' : s === 'done' ? 'Выполнен' : 'Отменён'
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cls =
    status === 'new'
      ? 'bg-amber-100 text-amber-700'
      : status === 'done'
        ? 'bg-green-100 text-green-700'
        : 'bg-slate-200 text-slate-500'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{statusLabel(status)}</span>
}

export function unitLabel(unit: string): string {
  if (unit === 'dozens') return 'дес'
  if (unit === 'pieces') return 'шт'
  return 'кг'
}

/** Цена в списке продаж из заказа. Яйцо хранится в ₽/дес, продукция — всегда
 *  в ₽/кг (продажа партии идёт по весу). Чтобы строка «3 шт × 150 ₽/кг» не
 *  сбивала с толку, для тушек показываем фактическую цену за штуку:
 *  сумма продажи ÷ штуки. */
export function fulfillmentPriceView(f: {
  sale_kind: string
  unit: string
  price: number
  amount: number
  actual_qty: number
}): { price: string; label: string; title?: string } {
  if (f.sale_kind === 'egg_sale') return { price: f.price.toFixed(2), label: '₽/дес' }
  if (f.unit === 'pieces') {
    const perPiece = f.actual_qty > 0 ? f.amount / f.actual_qty : f.price
    return {
      price: perPiece.toFixed(2),
      label: '₽/шт',
      title: 'Продажа идёт по весу; цена за штуку = сумма продажи ÷ штуки',
    }
  }
  return { price: f.price.toFixed(2), label: '₽/кг' }
}
