/** Общая логика карточки заказа для ПК- и мобильной версии: загрузка заказа,
 *  продажи из позиций (яйцо/продукция), статусы, удаление. Вёрстка у версий своя. */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { batchMetrics, listBatches } from '../../api/broiler'
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
import type { BatchMetrics, BroilerBatch, OrderDetail } from '../../api/types'

const today = () => new Date().toISOString().slice(0, 10)

export function useOrderDetail(orderId: number) {
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

  const saleItemRemaining = saleItem
    ? (order?.metrics.find((x) => x.item_id === saleItem.id)?.remaining_qty ?? null)
    : null

  const openSale = (itemId: number) => {
    if (!order) return
    const item = order.items.find((it) => it.id === itemId)
    const m = order.metrics.find((x) => x.item_id === itemId)
    if (!item || !m) return
    setSaleItem(item)
    setSDate(today())
    setSError(null)
    setSDozens(m.remaining_qty > 0 ? String(m.remaining_qty) : '')
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

  const itemsWithSales =
    order?.items.filter((it) => order.metrics.some((m) => m.item_id === it.id && m.fulfilled_qty > 0)) ?? []

  /** Первая позиция с остатком — для мобильной кнопки «Оформить продажу» на шапке. */
  const openSaleFirst = () => {
    if (!order) return
    const m = order.metrics.find((x) => x.item_id !== 0 && x.remaining_qty > 0)
    if (m) openSale(m.item_id)
  }

  return {
    order,
    navigate,
    batches,
    avgKg,
    error,
    saleOpen,
    setSaleOpen,
    saleItem,
    sDate,
    setSDate,
    sDozens,
    setSDozens,
    sPriceTen,
    setSPriceTen,
    sBatch,
    onBatchChange,
    sKg,
    setSKg,
    sPriceKg,
    setSPriceKg,
    sPieces,
    setSPieces,
    sPiecesAuto,
    setSPiecesAuto,
    sError,
    busy,
    saleItemRemaining,
    openSale,
    openSaleFirst,
    submitSale,
    applyDictPrice,
    removeFulfillment,
    changeStatus,
    removeOrder,
    fmt,
    itemsWithSales,
  }
}

export type OrderDetailCtl = ReturnType<typeof useOrderDetail>
