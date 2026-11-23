/** Карточка заказа: позиции (план/факт), продажи из заказа, статусы. */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { batchMetrics } from '../../api/broiler'
import { getPrices } from '../../api/dictionaries'
import {
  carcassWeight,
  createEggFulfillment,
  createProductFulfillment,
  deleteFulfillment,
  deleteOrder,
  getOrder,
  setOrderStatus,
} from '../../api/orders'
import { listBatches } from '../../api/broiler'
import type { BatchMetrics, BroilerBatch, OrderDetail } from '../../api/types'
import {
  Button,
  Card,
  DateInput,
  ErrorBox,
  Modal,
  Page,
  PriceDictButton,
  Select,
  TextInput,
} from '../../components/ui'
import { StatusBadge, unitLabel } from './ordersShared'

const today = () => new Date().toISOString().slice(0, 10)

export default function OrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const navigate = useNavigate()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [batches, setBatches] = useState<BroilerBatch[]>([])
  const [metricsById, setMetricsById] = useState<Record<number, BatchMetrics>>({})
  const [avgKg, setAvgKg] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // модалка продажи из позиции: kind='egg' | 'product'
  const [saleOpen, setSaleOpen] = useState(false)
  const [saleItem, setSaleItem] = useState<OrderDetail['items'][number] | null>(null)
  const [sDate, setSDate] = useState(today())
  const [sDozens, setSDozens] = useState('')
  const [sPriceTen, setSPriceTen] = useState('')
  const [sBatch, setSBatch] = useState('')
  const [sKg, setSKg] = useState('')
  const [sPriceKg, setSPriceKg] = useState('')
  const [sPieces, setSPieces] = useState('')
  const [sPiecesAuto, setSPiecesAuto] = useState(true)
  const [sError, setSError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [o, bs, cw] = await Promise.all([getOrder(orderId), listBatches(), carcassWeight()])
      setOrder(o)
      setBatches(bs)
      setAvgKg(cw.avg_kg)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  if (error && order === null) {
    return (
      <Page title="Заказ">
        <ErrorBox message={error} />
        <Link to="/orders" className="text-sm text-amber-700 hover:underline">
          ← к списку заказов
        </Link>
      </Page>
    )
  }
  if (order === null) return <Page title="Заказ">{null}</Page>

  const metric = order.metrics.find((m) => m.item_id === 0) // placeholder для линтера типов

  const openSale = (itemId: number) => {
    const item = order.items.find((it) => it.id === itemId)
    const m = order.metrics.find((x) => x.item_id === itemId)
    if (!item || !m) return
    setSaleItem(item)
    setSDate(today())
    setSError(null)
    setSDozens(String(m.remaining_qty))
    setSPriceTen(item.price_per_unit != null ? String(item.price_per_unit) : '')
    setSBatch('')
    setSKg('')
    // цена в заказе: яйцо и кг-продукция — за единицу массы; тушка — за штуку.
    // Форма продажи просит цену за кг → для тушки пересчитываем по среднему весу
    if (item.kind === 'product' && item.unit === 'pieces') {
      setSPriceKg(item.price_per_unit != null && avgKg ? (item.price_per_unit / avgKg).toFixed(2) : '')
    } else {
      setSPriceKg(item.price_per_unit != null ? String(item.price_per_unit) : '')
    }
    setSPieces('')
    setSPiecesAuto(true)
    setSaleOpen(true)
  }

  const getBatchMetrics = async (batchId: number) => {
    if (metricsById[batchId]) return metricsById[batchId]
    const m = await batchMetrics(batchId)
    setMetricsById((prev) => ({ ...prev, [batchId]: m }))
    return m
  }

  // предзаполнение кг из штук по выбранной партии
  const onBatchChange = async (batchId: string) => {
    setSBatch(batchId)
    if (!batchId || !saleItem || saleItem.unit !== 'pieces') return
    const m = await getBatchMetrics(Number(batchId))
    const avg = m.output_kg && m.slaughtered_head ? m.output_kg / m.slaughtered_head : avgKg
    if (avg) setSKg((Number(saleItem.qty) * avg).toFixed(2))
  }

  const submitSale = async () => {
    if (!saleItem) return
    setBusy(true)
    setSError(null)
    try {
      if (saleItem.kind === 'egg') {
        await createEggFulfillment(orderId, saleItem.id, {
          date: sDate,
          dozens: Number(sDozens),
          price_per_ten: Number(sPriceTen.replace(',', '.')),
        })
      } else {
        const pieces =
          saleItem.unit === 'pieces' && !sPiecesAuto && sPieces.trim() !== ''
            ? Number(sPieces.replace(',', '.'))
            : null
        await createProductFulfillment(
          orderId,
          saleItem.id,
          Number(sBatch),
          {
            date: sDate,
            product_kg: Number(sKg.replace(',', '.')),
            price_per_kg: Number(sPriceKg.replace(',', '.')),
          },
          pieces,
        )
      }
      setSaleOpen(false)
      setSaleItem(null)
      await load()
    } catch (e) {
      setSError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  // кнопка «Цена из справочника»: подставляет цену за десяток (яйцо) или за кг
  // (продукция; для тушки — из цены за штуку по среднему весу)
  const applyDictPrice = async () => {
    if (!saleItem) return
    try {
      const p = await getPrices()
      if (saleItem.kind === 'egg') {
        if (p.egg_price_per_ten == null) {
          setSError('Цена яйца не задана — Настройки → «Цены продукции»')
          return
        }
        setSPriceTen(String(p.egg_price_per_ten))
      } else {
        const pt = p.products.find((t) => t.id === saleItem.product_type_id)
        if (!pt || pt.price == null) {
          setSError(`Цена «${pt?.name ?? 'вида продукции'}» не задана — Настройки → «Цены продукции»`)
          return
        }
        if (saleItem.unit === 'pieces') {
          if (!avgKg) {
            setSError('Средний вес тушки неизвестен — введите цену за кг вручную')
            return
          }
          setSPriceKg((pt.price / avgKg).toFixed(2))
        } else {
          setSPriceKg(String(pt.price))
        }
      }
      setSError(null)
    } catch (e) {
      setSError(e instanceof Error ? e.message : 'Ошибка загрузки справочника')
    }
  }

  const removeFulfillment = async (fId: number) => {
    if (!window.confirm('Удалить продажу, созданную из заказа? Запись журнала денег уберётся тоже.')) return
    try {
      await deleteFulfillment(orderId, fId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  const changeStatus = async (status: 'done' | 'cancelled' | 'new') => {
    try {
      await setOrderStatus(orderId, status)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    }
  }

  const removeOrder = async () => {
    if (!window.confirm('Удалить заказ целиком?')) return
    try {
      await deleteOrder(orderId)
      navigate('/orders')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  const itemsWithSales = order.items.filter((it) =>
    order.metrics.some((m) => m.item_id === it.id && m.fulfilled_qty > 0),
  )
  void metric

  return (
    <Page
      title={`Заказ — ${order.buyer.name}`}
    >
      <Link to="/orders" className="text-sm text-amber-700 hover:underline">
        ← к списку заказов
      </Link>

      <ErrorBox message={error} />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <span className="text-sm text-slate-500">
          от {new Date(order.date + 'T00:00:00').toLocaleDateString()}
        </span>
        {order.status !== 'cancelled' && (
          <>
            <Button kind="secondary" onClick={() => navigate(`/routes?orders=${order.id}`)}>
              Маршрут
            </Button>
            <Button kind="secondary" onClick={() => void changeStatus('done')}>
              Закрыть заказ
            </Button>
            <Button kind="secondary" onClick={() => void changeStatus('cancelled')}>
              Отменить
            </Button>
          </>
        )}
        {order.status === 'cancelled' && (
          <Button kind="secondary" onClick={() => void changeStatus('new')}>
            Вернуть в работу
          </Button>
        )}
        <div className="grow" />
        {order.fulfillments.length === 0 && (
          <>
            <Link to={`/orders/${orderId}/edit`}>
              <Button kind="secondary">Изменить</Button>
            </Link>
            <Button kind="danger" onClick={() => void removeOrder()}>
              Удалить
            </Button>
          </>
        )}
      </div>

      <Card>
        <h3 className="font-semibold text-slate-900">Позиции: заказано → продано</h3>
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
                    {fmt(m.ordered_qty)} {unitLabel(m.unit)}
                  </td>
                  <td className="py-2 pr-2">
                    {fmt(m.fulfilled_qty)} {unitLabel(m.unit)}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">
                    {fmt(m.remaining_qty)} {unitLabel(m.unit)}
                  </td>
                  <td className="py-2 pr-2">{m.pct != null ? `${m.pct}%` : '—'}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {order.status !== 'cancelled' && m.remaining_qty > 0 && (
                      <Button onClick={() => openSale(it.id)}>Оформить продажу</Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {order.comment && <p className="mt-2 text-sm text-slate-500">{order.comment}</p>}
      </Card>

      {itemsWithSales.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-900">Продажи по заказу</h3>
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
                const priceUnit = f.sale_kind === 'egg_sale' ? '₽/дес' : '₽/кг'
                return (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2">
                      {new Date(f.sale_date + 'T00:00:00').toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-2">{label}</td>
                    <td className="py-2 pr-2">
                      {fmt(f.actual_qty)} {unitLabel(f.unit)}
                    </td>
                    <td className="py-2 pr-2">
                      {fmt(f.price)} {priceUnit}
                    </td>
                    <td className="py-2 pr-2 text-right">{fmt(f.amount)} ₽</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => void removeFulfillment(f.id)}
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
          <p className="mt-2 text-xs text-slate-400">
            Доход по этим продажам уже отражён в журнале денег (авто-записи).
          </p>
        </Card>
      )}

      <Modal
        open={saleOpen}
        title={saleItem ? `Продажа — ${saleItem.kind === 'egg' ? 'яйцо' : 'продукция'}` : 'Продажа'}
        onClose={() => setSaleOpen(false)}
      >
        <ErrorBox message={sError} />
        {saleItem?.kind === 'egg' ? (
          <div className="space-y-3">
            <DateInput value={sDate} onChange={setSDate} />
            <TextInput value={sDozens} onChange={setSDozens} placeholder="десятков (факт)" required />
            <div className="flex items-start gap-2">
              <TextInput value={sPriceTen} onChange={setSPriceTen} placeholder="цена за десяток" required />
              <PriceDictButton onClick={() => void applyDictPrice()} />
            </div>
            <p className="text-xs text-slate-400">
              Покупатель — {order.buyer.name} (из заказа). Доход попадёт в журнал денег автоматически.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <DateInput value={sDate} onChange={setSDate} />
            <Select
              value={sBatch}
              onChange={(v) => void onBatchChange(v)}
              options={[
                { value: '', label: '— выберите партию —' },
                ...batches
                  .filter((b) => b.status === 'active' || b.status === 'closed')
                  .map((b) => ({ value: String(b.id), label: `${b.code} · ${b.cross ?? ''}` })),
              ]}
            />
            <TextInput value={sKg} onChange={setSKg} placeholder="вес, кг (факт)" required />
            <div>
              <div className="flex items-start gap-2">
                <TextInput value={sPriceKg} onChange={setSPriceKg} placeholder="цена за кг" required />
                <PriceDictButton onClick={() => void applyDictPrice()} />
              </div>
              {saleItem?.unit === 'pieces' && avgKg && sPriceKg.trim() !== '' && !Number.isNaN(Number(sPriceKg.replace(',', '.'))) && (
                <p className="mt-1 text-xs text-slate-400">
                  ≈ {fmt(Number(sPriceKg.replace(',', '.')) * avgKg)} ₽/шт при среднем весе тушки {avgKg.toFixed(2)} кг
                </p>
              )}
            </div>
            {saleItem?.unit === 'pieces' && (
              <>
                <CheckboxRow
                  checked={sPiecesAuto}
                  onChange={setSPiecesAuto}
                  label={
                    avgKg
                      ? `штук считать по среднему весу тушки (${avgKg.toFixed(2)} кг)`
                      : 'штук считать по среднему весу тушки'
                  }
                />
                {!sPiecesAuto && (
                  <TextInput value={sPieces} onChange={setSPieces} placeholder="штук фактически" />
                )}
              </>
            )}
            <p className="text-xs text-slate-400">
              Покупатель — {order.buyer.name} (из заказа). Вид продукции берётся из позиции заказа.
            </p>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button onClick={() => void submitSale()} disabled={busy}>
            Оформить
          </Button>
          <Button kind="secondary" onClick={() => setSaleOpen(false)}>
            Отмена
          </Button>
        </div>
      </Modal>
    </Page>
  )
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
      />
      {label}
    </label>
  )
}
