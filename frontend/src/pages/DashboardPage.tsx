import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../api/reports'
import type { Dashboard, DashBatch, DashOrder } from '../api/types'
import { Card, ErrorBox, Page } from '../components/ui'

/** Дата dd.mm.yyyy из ISO-строки. */
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU')

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)

/** Краткое описание позиций заказа: «Яйцо 20 дес · Тушка 6 шт». */
function itemsSummary(items: DashOrder['items']): string {
  const unitLabel: Record<string, string> = { dozens: 'дес', pieces: 'шт', kg: 'кг' }
  return items
    .map((i) => `${i.kind === 'egg' ? 'Яйцо' : 'Продукция'} ${i.qty} ${unitLabel[i.unit] ?? i.unit}`)
    .join(' · ')
}

const STATUS_LABEL: Record<string, string> = {
  new: 'в работе',
  done: 'выполнен',
  cancelled: 'отменён',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-amber-100 text-amber-800',
    done: 'bg-green-100 text-green-800',
    cancelled: 'bg-slate-200 text-slate-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-100'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/** KPI-карточка: вся площадь — ссылка в раздел. */
function KpiCard({ to, title, main, sub }: { to: string; title: string; main: string; sub: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md hover:ring-1 hover:ring-amber-300"
    >
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{main}</div>
      <div className="mt-0.5 text-sm text-slate-500">{sub}</div>
    </Link>
  )
}

/** Секция «Последние…» со ссылкой «все …» в шапке. */
function RecentSection({
  title,
  allHref,
  allTitle,
  children,
}: {
  title: string
  allHref: string
  allTitle: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <Link to={allHref} className="text-sm text-amber-600 hover:underline">
          {allTitle} →
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

function BatchRowLine({ b }: { b: DashBatch }) {
  return (
    <Link
      to={`/batches/${b.id}`}
      className="block rounded-xl px-2 py-2 transition hover:bg-amber-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-900">{b.code}</span>
        <span className="text-sm text-slate-500">{b.place_name}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-600">
        <span>с {fmtDate(b.start_date)}</span>
        <span>{b.heads_alive} гол</span>
        {b.age_days !== null ? (
          <span className="font-medium text-amber-700">{b.age_days} дн</span>
        ) : (
          <span className="text-slate-400">закрыта</span>
        )}
        {b.last_weighing ? (
          <span className="text-slate-500">
            взвешивание {fmtDate(b.last_weighing.date)} · {b.last_weighing.avg_weight_kg} кг
          </span>
        ) : (
          <span className="text-slate-400">без взвешиваний</span>
        )}
      </div>
    </Link>
  )
}

function OrderRowLine({ o }: { o: DashOrder }) {
  return (
    <Link
      to={`/orders/${o.id}`}
      className="block rounded-xl px-2 py-2 transition hover:bg-amber-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-900">{o.buyer_name}</span>
        <StatusBadge status={o.status} />
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
        <span>от {fmtDate(o.date)}</span>
        <span className="text-slate-500">{itemsSummary(o.items)}</span>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
  }, [])

  if (error) return <Page title="Дашборд"><ErrorBox message={error} /></Page>
  if (!data) return <Page title="Дашборд"><p className="text-slate-500">Загрузка…</p></Page>

  return (
    <Page title="Дашборд">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          to="/batches"
          title="Активные партии"
          main={`${data.active_batches}`}
          sub={`${data.active_heads} гол живых`}
        />
        <KpiCard
          to="/flocks"
          title="Яйцо за месяц"
          main={`${data.egg_collected} шт`}
          sub={`продано ${data.egg_dozens_sold} дес`}
        />
        <KpiCard
          to="/money"
          title="Деньги за месяц"
          main={`${data.month_balance >= 0 ? '+' : ''}${fmtMoney(data.month_balance)} ₽`}
          sub={`доход ${fmtMoney(data.month_income)} · расход ${fmtMoney(data.month_expense)}`}
        />
        <KpiCard
          to="/orders"
          title="Открытые заказы"
          main={`${data.orders_open}`}
          sub="покупатели ждут продукцию"
        />
        <KpiCard
          to="/feed"
          title="Корм на складе"
          main={`${fmtMoney(data.feed_stock_kg)} кг`}
          sub="остаток по всем закупкам"
        />
        <KpiCard
          to="/reports"
          title="Отчёты"
          main="📊"
          sub="экономика партий, P&L"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentSection title="Последние партии" allHref="/batches" allTitle="Все партии">
          {data.recent_batches.length === 0 ? (
            <p className="px-2 text-sm text-slate-400">Партий пока нет</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent_batches.map((b) => (
                <BatchRowLine key={b.id} b={b} />
              ))}
            </div>
          )}
        </RecentSection>

        <RecentSection title="Последние заказы" allHref="/orders" allTitle="Все заказы">
          {data.recent_orders.length === 0 ? (
            <p className="px-2 text-sm text-slate-400">Заказов пока нет</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent_orders.map((o) => (
                <OrderRowLine key={o.id} o={o} />
              ))}
            </div>
          )}
        </RecentSection>
      </div>
    </Page>
  )
}
