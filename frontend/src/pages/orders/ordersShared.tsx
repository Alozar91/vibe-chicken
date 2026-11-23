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
