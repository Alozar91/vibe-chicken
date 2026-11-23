/** Карточка заказа (мобильная версия): позиции и продажи карточками,
 *  крупные кнопки. Логика и модалка продажи — общие с ПК-версией. */

import { Link, useParams } from 'react-router-dom'
import { Button, Card, ErrorBox, Page } from '../components/ui'
import { StatusBadge, fulfillmentPriceView, unitLabel } from '../pages/orders/ordersShared'
import { useOrderDetail } from '../pages/orders/useOrderDetail'
import SaleModal from '../pages/orders/SaleModal'

export default function OrderDetailMobile() {
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
    <Page title={`Заказ — ${order.buyer.name}`}>
      <Link to="/orders" className="text-sm text-amber-700 hover:underline">
        ← к списку заказов
      </Link>

      <ErrorBox message={c.error} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <span className="text-sm text-slate-500">
          от {new Date(order.date + 'T00:00:00').toLocaleDateString()}
        </span>
      </div>

      {/* действия — крупные кнопки на всю ширину */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {order.status !== 'cancelled' && (
          <>
            <Button onClick={() => c.openSaleFirst()}>Оформить продажу</Button>
            <Button kind="secondary" onClick={() => void c.changeStatus('done')}>
              Закрыть заказ
            </Button>
            <Button kind="secondary" onClick={() => c.navigate(`/routes?orders=${order.id}`)}>
              Маршрут
            </Button>
            <Button kind="secondary" onClick={() => void c.changeStatus('cancelled')}>
              Отменить
            </Button>
          </>
        )}
        {order.status === 'cancelled' && (
          <>
            <Button onClick={() => void c.changeStatus('new')}>Вернуть в работу</Button>
          </>
        )}
      </div>

      {/* позиции карточками */}
      <h3 className="mt-4 font-semibold text-slate-900">Позиции: заказано → продано</h3>
      <div className="mt-2 space-y-2">
        {order.items.map((it) => {
          const m = order.metrics.find((x) => x.item_id === it.id)
          if (!m) return null
          const name = it.kind === 'egg' ? 'Яйцо' : (m.product_type_name ?? `#${it.product_type_id}`)
          return (
            <Card key={it.id} className="!p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{name}</span>
                <div className="grow" />
                {m.pct != null && (
                  <span className={`text-sm font-medium ${m.pct >= 100 ? 'text-green-600' : 'text-slate-500'}`}>
                    {m.pct}%
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-3 text-sm text-slate-600">
                <span>Заказано: {c.fmt(m.ordered_qty)} {unitLabel(m.unit)}</span>
                <span>Продано: {c.fmt(m.fulfilled_qty)}</span>
                <span className="text-slate-400">осталось {c.fmt(m.remaining_qty)}</span>
              </div>
              {order.status !== 'cancelled' && m.remaining_qty > 0 && (
                <Button className="mt-2 w-full" onClick={() => c.openSale(it.id)}>
                  Оформить продажу
                </Button>
              )}
            </Card>
          )
        })}
        {order.comment && <p className="px-1 text-sm text-slate-500">{order.comment}</p>}
      </div>

      {/* продажи списком */}
      {c.itemsWithSales.length > 0 && (
        <>
          <h3 className="mt-4 font-semibold text-slate-900">Продажи по заказу</h3>
          <div className="mt-2 space-y-2">
            {order.fulfillments.map((f) => {
              const m = order.metrics.find((x) => x.item_id === f.item_id)
              const label = f.sale_kind === 'egg_sale' ? 'Яйцо' : (m?.product_type_name ?? 'Продукция')
              const pv = fulfillmentPriceView(f)
              return (
                <Card key={f.id} className="!p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{label}</span>
                    <div className="grow" />
                    <span className="font-semibold text-slate-900">{c.fmt(f.amount)} ₽</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {new Date(f.sale_date + 'T00:00:00').toLocaleDateString()} · {c.fmt(f.actual_qty)}{' '}
                    {unitLabel(f.unit)} по {pv.price} {pv.label}
                  </p>
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <button
                      onClick={() => void c.removeFulfillment(f.id)}
                      className="text-sm text-red-500 active:opacity-60"
                    >
                      Удалить продажу
                    </button>
                  </div>
                </Card>
              )
            })}
            <p className="px-1 text-xs text-slate-400">
              Доход по этим продажам уже отражён в журнале денег (авто-записи).
            </p>
          </div>
        </>
      )}

      {/* удаление/правка заказа — когда продаж ещё нет */}
      {order.fulfillments.length === 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to={`/orders/${orderId}/edit`} className="contents">
            <Button kind="secondary">Изменить</Button>
          </Link>
          <Button kind="danger" onClick={() => void c.removeOrder()}>
            Удалить
          </Button>
        </div>
      )}

      <SaleModal c={c} />
    </Page>
  )
}
