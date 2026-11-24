/** Форма заказа: создание и редактирование (позиции: яйцо или вид продукции).
 *  Отдельная страница, т.к. список позиций динамический — модалка тесна.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createOrder, getOrder, updateOrder } from '../../api/orders'
import { listBuyers, listProductTypes } from '../../api/dictionaries'
import type { Buyer, ProductType } from '../../api/types'
import { Button, Card, DateInput, ErrorBox, Page, Select, TextInput } from '../../components/ui'

interface Row {
  kind: 'egg' | 'product'
  product_type_id: string
  qty: string
  price: string
}

const emptyRow: Row = { kind: 'egg', product_type_id: '', qty: '', price: '' }
const today = () => new Date().toISOString().slice(0, 10)

/** Подписи полей позиции в зависимости от единицы: яйцо — десятки,
 *  тушка — штуки (₽/шт), остальная продукция — кг (₽/кг). */
type ProductTypeLike = { id: number; unit: string }

function rowQtyLabel(r: Row, productTypes: ProductTypeLike[]): string {
  if (r.kind === 'egg') return 'Количество, десятков'
  const pt = productTypes.find((p) => String(p.id) === r.product_type_id)
  if (!pt) return 'Количество'
  return pt.unit === 'pieces' ? 'Количество, штук' : 'Количество, кг'
}

function rowPriceLabel(r: Row, productTypes: ProductTypeLike[]): string {
  if (r.kind === 'egg') return 'Цена за десяток (необяз.)'
  const pt = productTypes.find((p) => String(p.id) === r.product_type_id)
  if (!pt) return 'Цена за ед. (необяз.)'
  return pt.unit === 'pieces' ? 'Цена за штуку (примерно, необяз.)' : 'Цена за кг (необяз.)'
}

export default function OrderFormPage() {
  const { id } = useParams()
  const orderId = id ? Number(id) : null
  const navigate = useNavigate()

  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [date, setDate] = useState(today())
  const [buyerId, setBuyerId] = useState('')
  const [comment, setComment] = useState('')
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const [bs, pts] = await Promise.all([listBuyers(), listProductTypes()])
        setBuyers(bs)
        setProductTypes(pts)
        if (orderId != null) {
          const o = await getOrder(orderId)
          setDate(o.date)
          setBuyerId(String(o.buyer.id))
          setComment(o.comment ?? '')
          setRows(
            o.items.map((it) => ({
              kind: it.kind,
              product_type_id: it.product_type_id ? String(it.product_type_id) : '',
              qty: String(it.qty),
              price: it.price_per_unit != null ? String(it.price_per_unit) : '',
            })),
          )
        }
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const items = rows
        .filter((r) => r.qty.trim() !== '')
        .map((r) => ({
          kind: r.kind,
          product_type_id: r.kind === 'product' ? Number(r.product_type_id) : null,
          qty: Number(r.qty.replace(',', '.')),
          price_per_unit: r.price.trim() === '' ? null : Number(r.price.replace(',', '.')),
        }))
      const data = { date, buyer_id: Number(buyerId), comment: comment.trim() || null, items }
      if (orderId == null) await createOrder(data)
      else await updateOrder(orderId, data)
      navigate('/orders')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const rowLabel = (r: Row) => {
    if (r.kind === 'egg') return 'Яйцо (десятки)'
    const pt = productTypes.find((p) => p.id === Number(r.product_type_id))
    const unit = pt?.unit === 'pieces' ? 'шт' : 'кг'
    return `Продукция — ${pt?.name ?? '…'} (${unit})`
  }

  return (
    <Page title={orderId == null ? 'Новый заказ' : 'Изменить заказ'}>
      <Card>
        <ErrorBox message={error} />
        {loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Дата заказа</span>
                <DateInput value={date} onChange={setDate} required />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Покупатель</span>
                <Select
                  value={buyerId}
                  onChange={setBuyerId}
                  options={[
                    { value: '', label: '— выберите —' },
                    ...buyers.map((b) => ({ value: String(b.id), label: b.name })),
                  ]}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">Комментарий</span>
                <TextInput value={comment} onChange={setComment} placeholder="необязательно" />
              </label>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Позиции</p>
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600">{rowLabel(r)}</span>
                    <div className="grow" />
                    <button
                      type="button"
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      disabled={rows.length === 1}
                      className="text-xs text-red-500 hover:underline disabled:opacity-30"
                    >
                      убрать
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-slate-400">Вид</span>
                      <Select
                        value={r.kind}
                        onChange={(v) => setRow(i, { kind: v as 'egg' | 'product', product_type_id: '' })}
                        options={[
                          { value: 'egg', label: 'Яйцо' },
                          { value: 'product', label: 'Продукция' },
                        ]}
                      />
                    </label>
                    {r.kind === 'product' && (
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs text-slate-400">Вид продукции</span>
                        <Select
                          value={r.product_type_id}
                          onChange={(v) => setRow(i, { product_type_id: v })}
                          options={[
                            { value: '', label: '— выберите —' },
                            ...productTypes.map((p) => ({
                              value: String(p.id),
                              label: `${p.name} (${p.unit === 'pieces' ? 'шт' : 'кг'})`,
                            })),
                          ]}
                        />
                      </label>
                    )}
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-slate-400">
                        {rowQtyLabel(r, productTypes)}
                      </span>
                      <TextInput value={r.qty} onChange={(v) => setRow(i, { qty: v })} required />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-slate-400">
                        {rowPriceLabel(r, productTypes)}
                      </span>
                      <TextInput value={r.price} onChange={(v) => setRow(i, { price: v })} />
                    </label>
                  </div>
                </div>
              ))}
              <Button kind="secondary" onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}>
                + позиция
              </Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>
                Сохранить
              </Button>
              <Button kind="secondary" onClick={() => navigate('/orders')}>
                Отмена
              </Button>
            </div>
          </form>
        )}
      </Card>
    </Page>
  )
}
