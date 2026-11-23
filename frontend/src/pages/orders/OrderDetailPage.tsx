/** Карточка заказа (ПК): позиции (план/факт), продажи из заказа, статусы.
 *  Логика — в useOrderDetail; мобильная версия — OrderDetailMobile. */

import { Link, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  ErrorBox,
  Page,
} from '../../components/ui'
import { StatusBadge, fulfillmentPriceView, unitLabel } from './ordersShared'
import { useOrderDetail } from './useOrderDetail'
import SaleModal from './SaleModal'

export default function OrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const c = useOrderDetail(orderId)

  if (c.error && c.order === null) {
    return (
      <Page title="Заказ">
        <ErrorBox message={c.error} />
        <Link to="/orders" className="text-sm text-amber-700 hover:underline">
          ← к списку заказов
        </Link>
      </Page>
    )
  }
  if (c.order === null) return <Page title="Заказ">{null}</Page>

  const order = c.order

  return (
    <Page
      title={`Заказ — ${order.buyer.name}`}
    >
      <Link to="/orders" className="text-sm text-amber-700 hover:underline">
        ← к списку заказов
      </Link>

      <ErrorBox message={c.error} />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <span className="text-sm text-slate-500">
          от {new Date(order.date + 'T00:00:00').toLocaleDateString()}
        </span>
        {order.status !== 'cancelled' && (
          <>
            <Button kind="secondary" onClick={() => c.navigate(`/routes?orders=${order.id}`)}>
              Маршрут
            </Button>
            <Button kind="secondary" onClick={() => void c.changeStatus('done')}>
              Закрыть заказ
            </Button>
            <Button kind="secondary" onClick={() => void c.changeStatus('cancelled')}>
              Отменить
            </Button>
          </>
        )}
        {order.status === 'cancelled' && (
          <Button kind="secondary" onClick={() => void c.changeStatus('new')}>
            Вернуть в работу
          </Button>
        )}
        <div className="grow" />
        {order.fulfillments.length === 0 && (
          <>
            <Link to={`/orders/${orderId}/edit`}>
              <Button kind="secondary">Изменить</Button>
            </Link>
            <Button kind="danger" onClick={() => void c.removeOrder()}>
              Удалить
            </Button>
          </>
        )}
      </div>

      <Card>
        <h3 className="font-semibold text-slate-900">Позиции: заказано → продано</h3>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-2">Что</th>
                <th className="pb-2">Заказано</th>
                <th className="pb-2">Продано</th>
                <th className="pb-2">Осталось</th>
                <th className="pb-2">Выполнено</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => {
                const m = order.metrics.find((x) => x.item_id === it.id)
                if (!m) return null
                return (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2">
                      {it.kind === 'egg' ? 'Яйцо' : (m.product_type_name ?? `#${it.product_type_id}`)}
                    </td>
                    <td className="py-2 pr-2">
                      {c.fmt(m.ordered_qty)} {unitLabel(m.unit)}
                    </td>
                    <td className="py-2 pr-2">
                      {c.fmt(m.fulfilled_qty)} {unitLabel(m.unit)}
                    </td>
                    <td className="py-2 pr-2 text-slate-500">
                      {c.fmt(m.remaining_qty)} {unitLabel(m.unit)}
                    </td>
                    <td className="py-2 pr-2">
                      {m.pct != null && (
                        <span className={m.pct > 100 ? 'font-medium text-amber-600' : ''}>
                          {m.pct}%{m.pct > 100 ? ' (сверх плана)' : ''}
                        </span>
                      )}
                      {m.pct == null && '—'}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {order.status !== 'cancelled' && (
                        <Button onClick={() => c.openSale(it.id)}>Оформить продажу</Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {order.comment && <p className="mt-2 text-sm text-slate-500">{order.comment}</p>}
      </Card>

      {c.itemsWithSales.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-900">Продажи по заказу</h3>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-2">Дата</th>
                  <th className="pb-2">Тип</th>
                  <th className="pb-2">Количество</th>
                  <th className="pb-2">Цена</th>
                  <th className="pb-2 text-right">Сумма</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {order.fulfillments.map((f) => {
                  const m = order.metrics.find((x) => x.item_id === f.item_id)
                  const label = f.sale_kind === 'egg_sale' ? 'Яйцо' : (m?.product_type_name ?? 'Продукция')
                  const pv = fulfillmentPriceView(f)
                  return (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="py-2 pr-2">
                        {new Date(f.sale_date + 'T00:00:00').toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-2">{label}</td>
                      <td className="py-2 pr-2">
                        {c.fmt(f.actual_qty)} {unitLabel(f.unit)}
                      </td>
                      <td className="py-2 pr-2" title={pv.title}>
                        {pv.price} {pv.label}
                      </td>
                      <td className="py-2 pr-2 text-right">{c.fmt(f.amount)} ₽</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => void c.removeFulfillment(f.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          удалить
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Доход по этим продажам уже отражён в журнале денег (авто-записи).
          </p>
        </Card>
      )}

      <SaleModal c={c} />
    </Page>
  )
}
