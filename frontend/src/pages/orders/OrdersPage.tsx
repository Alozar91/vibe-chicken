/** Заказы покупателей: список заказов со статусами и прогрессом выполнения. */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listOrders } from '../../api/orders'
import type { Order, OrderStatus } from '../../api/types'
import { Button, Card, ErrorBox, Page } from '../../components/ui'
import { StatusBadge, statusLabel, unitLabel } from './ordersShared'

const statusOrder: Record<OrderStatus, number> = { new: 0, done: 1, cancelled: 2 }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | OrderStatus>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await listOrders())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // сводка по позициям заказа (план/факт — из элементов без metrics на списке;
  // детали и проценты — в карточке заказа)
  const visible = [...orders]
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.id - a.id)
    .filter((o) => filter === 'all' || o.status === filter)

  const summarize = (o: Order) => {
    const parts = o.items.map((it) => {
      const name = it.kind === 'egg' ? 'Яйцо' : (it.product_type?.name ?? `#${it.product_type_id}`)
      return `${name} ${it.qty} ${unitLabel(it.unit)}`
    })
    return parts.join(' · ')
  }

  const plannedAmount = (o: Order) =>
    o.items.reduce((s, it) => s + (it.price_per_unit != null ? it.qty * it.price_per_unit : 0), 0)

  return (
    <Page title="Заказы покупателей">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'Все'],
            ['new', 'Новые'],
            ['done', 'Выполнены'],
            ['cancelled', 'Отменены'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filter === value ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="grow" />
        <Link to="/orders/new">
          <Button>Новый заказ</Button>
        </Link>
      </div>

      <ErrorBox message={error} />
      {loading && <p className="text-sm text-slate-400">Загрузка…</p>}

      <div className="space-y-3">
        {visible.map((o) => (
          <Card key={o.id}>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={o.status} />
              <span className="text-xs text-slate-400">{statusLabel(o.status)}</span>
              <div className="grow" />
              <span className="text-xs text-slate-400">
                {new Date(o.date + 'T00:00:00').toLocaleDateString()}
              </span>
            </div>
            <Link to={`/orders/${o.id}`} className="mt-1 block font-semibold text-slate-900 hover:text-amber-600">
              {o.buyer.name}
            </Link>
            <p className="mt-0.5 text-sm text-slate-500">{summarize(o)}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
              {plannedAmount(o) > 0 && <span>по ценам заказа ≈ {plannedAmount(o).toLocaleString('ru-RU')} ₽</span>}
              {o.comment && <span className="truncate">{o.comment}</span>}
            </div>
          </Card>
        ))}
        {!loading && visible.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">
              {filter === 'all' ? 'Заказов пока нет' : 'В этой категории пусто'}
            </p>
          </Card>
        )}
      </div>
    </Page>
  )
}
