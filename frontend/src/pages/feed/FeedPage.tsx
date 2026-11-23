/** Страница «Склад корма»: остатки, закупки, корректировки.
 *  Продавцы в форме закупки — только с тегом «Корм» (жёсткое правило).
 */

import { useEffect, useState } from 'react'
import {
  createAdjustment,
  createPurchase,
  deleteAdjustment,
  deletePurchase,
  listAdjustments,
  listPurchases,
  stock,
} from '../../api/feed'
import type { FeedAdjustment, FeedPurchase, FeedStockRow } from '../../api/types'
import { Button, Card, ErrorBox, Modal, Page, Select, TextInput, DateInput } from '../../components/ui'
import { useDictsForFeed } from '../../hooks/useDictsForFeed'

const today = () => new Date().toISOString().slice(0, 10)

export default function FeedPage() {
  const { categories, brands, feedVendors, error: dictsError } = useDictsForFeed()
  const [rows, setRows] = useState<FeedStockRow[]>([])
  const [purchases, setPurchases] = useState<FeedPurchase[]>([])
  const [adjustments, setAdjustments] = useState<FeedAdjustment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // модалка закупки
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [pDate, setPDate] = useState(today())
  const [pCat, setPCat] = useState('')
  const [pBrand, setPBrand] = useState('')
  const [pVendor, setPVendor] = useState('')
  const [pKg, setPKg] = useState('')
  const [pCost, setPCost] = useState('')
  const [pComment, setPComment] = useState('')
  const [pError, setPError] = useState<string | null>(null)

  // модалка корректировки
  const [adjOpen, setAdjOpen] = useState(false)
  const [aDate, setADate] = useState(today())
  const [aCat, setACat] = useState('')
  const [aBrand, setABrand] = useState('')
  const [aKg, setAKg] = useState('')
  const [aComment, setAComment] = useState('')
  const [aError, setAError] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const [r, p, a] = await Promise.all([stock(), listPurchases(), listAdjustments()])
      setRows(r)
      setPurchases(p)
      setAdjustments(a)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const totalStock = rows.reduce((s, r) => s + r.stock_kg, 0)

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`
  const brandName = (id: number) => brands.find((b) => b.id === id)?.name ?? `#${id}`
  const vendorName = (id: number) => feedVendors.find((v) => v.id === id)?.name ?? `#${id}`

  const openPurchase = () => {
    setPDate(today())
    setPCat(categories[0]?.id.toString() ?? '')
    setPBrand(brands[0]?.id.toString() ?? '')
    setPVendor(feedVendors[0]?.id.toString() ?? '')
    setPKg('')
    setPCost('')
    setPComment('')
    setPError(null)
    setPurchaseOpen(true)
  }

  const openAdjustment = () => {
    setADate(today())
    setACat(categories[0]?.id.toString() ?? '')
    setABrand(brands[0]?.id.toString() ?? '')
    setAKg('')
    setAComment('')
    setAError(null)
    setAdjOpen(true)
  }

  const submitPurchase = async () => {
    setBusy(true)
    setPError(null)
    try {
      await createPurchase({
        date: pDate,
        feed_category_id: Number(pCat),
        feed_brand_id: Number(pBrand),
        vendor_id: Number(pVendor),
        kg: Number(pKg),
        total_cost: Number(pCost),
        comment: pComment.trim() || null,
      })
      setPurchaseOpen(false)
      await refresh()
    } catch (e) {
      setPError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const submitAdjustment = async () => {
    setBusy(true)
    setAError(null)
    try {
      await createAdjustment({
        date: aDate,
        feed_category_id: Number(aCat),
        feed_brand_id: Number(aBrand),
        kg_delta: Number(aKg),
        comment: aComment.trim() || null,
      })
      setAdjOpen(false)
      await refresh()
    } catch (e) {
      setAError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const removePurchase = async (id: number) => {
    setBusy(true)
    try {
      await deletePurchase(id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const removeAdjustment = async (id: number) => {
    setBusy(true)
    try {
      await deleteAdjustment(id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const noDicts = categories.length === 0 || brands.length === 0
  const noVendors = feedVendors.length === 0

  return (
    <Page title="Склад корма">
      <ErrorBox message={error ?? dictsError} />

      {/* Остатки */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">
            Остатки — всего{' '}
            <span className={totalStock < 0 ? 'text-red-600' : 'text-amber-600'}>
              {totalStock.toFixed(1)} кг
            </span>
          </h3>
          <div className="flex gap-2">
            <Button onClick={openPurchase} disabled={noDicts || noVendors}>
              Закупка
            </Button>
            <Button kind="secondary" onClick={openAdjustment} disabled={noDicts}>
              Корректировка
            </Button>
          </div>
        </div>
        {noDicts && (
          <p className="mt-2 text-sm text-slate-500">
            Сначала добавьте категории и производителей в разделе «Корм и продукция».
          </p>
        )}
        {!noDicts && noVendors && (
          <p className="mt-2 text-sm text-slate-500">
            Нет продавцов с тегом «Корм» — добавьте в разделе «Продавцы».
          </p>
        )}
        <div className="overflow-x-auto">
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="pb-2">Категория</th>
              <th className="pb-2">Производитель</th>
              <th className="pb-2 text-right">Куплено</th>
              <th className="pb-2 text-right">Израсходовано</th>
              <th className="pb-2 text-right">Корректир.</th>
              <th className="pb-2 text-right">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.feed_category_id}-${r.feed_brand_id}`} className="border-t border-slate-100">
                <td className="py-2">{r.feed_category_name}</td>
                <td className="py-2">{r.feed_brand_name}</td>
                <td className="py-2 text-right">{r.purchased_kg}</td>
                <td className="py-2 text-right">{r.used_kg}</td>
                <td className="py-2 text-right">{r.adjusted_kg || ''}</td>
                <td className={`py-2 text-right font-medium ${r.stock_kg < 0 ? 'text-red-600' : ''}`}>
                  {r.stock_kg}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
        {rows.some((r) => r.stock_kg < 0) && (
          <p className="mt-2 text-sm text-red-600">
            ⚠ Отрицательный остаток: расход превысил закупки. Заведите корректировку или закупку.
          </p>
        )}
        {!loading && rows.length === 0 && !noDicts && (
          <p className="mt-3 text-sm text-slate-400">Пока пусто — сделайте первую закупку</p>
        )}
      </Card>

      {/* Закупки */}
      <Card className="mt-4">
        <h3 className="font-semibold text-slate-900">Закупки</h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {purchases.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="text-slate-400">{p.date}</span>
              <span className="font-medium text-slate-900">{catName(p.feed_category_id)}</span>
              <span className="text-slate-500">{brandName(p.feed_brand_id)}</span>
              <span className="text-slate-500">{p.kg} кг</span>
              <span className="text-slate-500">{p.total_cost} ₽</span>
              <span className="text-slate-400">{vendorName(p.vendor_id)}</span>
              {p.comment && <span className="text-xs text-slate-400">{p.comment}</span>}
              <Button kind="danger" onClick={() => removePurchase(p.id)} disabled={busy}>
                Удалить
              </Button>
            </li>
          ))}
          {!loading && purchases.length === 0 && (
            <li className="py-2 text-sm text-slate-400">Закупок пока нет</li>
          )}
        </ul>
      </Card>

      {/* Корректировки */}
      <Card className="mt-4">
        <h3 className="font-semibold text-slate-900">Корректировки (инвентаризация)</h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {adjustments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="text-slate-400">{a.date}</span>
              <span className="font-medium text-slate-900">{catName(a.feed_category_id)}</span>
              <span className="text-slate-500">{brandName(a.feed_brand_id)}</span>
              <span className={a.kg_delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                {a.kg_delta > 0 ? '+' : ''}
                {a.kg_delta} кг
              </span>
              {a.comment && <span className="text-xs text-slate-400">{a.comment}</span>}
              <Button kind="danger" onClick={() => removeAdjustment(a.id)} disabled={busy}>
                Удалить
              </Button>
            </li>
          ))}
          {!loading && adjustments.length === 0 && (
            <li className="py-2 text-sm text-slate-400">Корректировок пока нет</li>
          )}
        </ul>
      </Card>

      {/* Модалка закупки */}
      <Modal open={purchaseOpen} title="Закупка корма" onClose={() => setPurchaseOpen(false)}>
        <ErrorBox message={pError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitPurchase()
          }}
          className="mt-1 space-y-3"
        >
          <DateInput value={pDate} onChange={setPDate} required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              value={pCat}
              onChange={setPCat}
              options={categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
            />
            <Select
              value={pBrand}
              onChange={setPBrand}
              options={brands.map((b) => ({ value: b.id.toString(), label: b.name }))}
            />
          </div>
          <Select
            value={pVendor}
            onChange={setPVendor}
            options={feedVendors.map((v) => ({ value: v.id.toString(), label: v.name }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput value={pKg} onChange={setPKg} placeholder="Вес, кг" required />
            <TextInput value={pCost} onChange={setPCost} placeholder="Стоимость, ₽" required />
          </div>
          <TextInput value={pComment} onChange={setPComment} placeholder="Комментарий (необязательно)" />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy || !pCat || !pBrand || !pVendor}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setPurchaseOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модалка корректировки */}
      <Modal open={adjOpen} title="Корректировка остатка" onClose={() => setAdjOpen(false)}>
        <ErrorBox message={aError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitAdjustment()
          }}
          className="mt-1 space-y-3"
        >
          <DateInput value={aDate} onChange={setADate} required />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              value={aCat}
              onChange={setACat}
              options={categories.map((c) => ({ value: c.id.toString(), label: c.name }))}
            />
            <Select
              value={aBrand}
              onChange={setABrand}
              options={brands.map((b) => ({ value: b.id.toString(), label: b.name }))}
            />
          </div>
          <TextInput
            value={aKg}
            onChange={setAKg}
            placeholder="+2.5 — нашли, −1 — усушка"
            required
          />
          <TextInput value={aComment} onChange={setAComment} placeholder="Комментарий (необязательно)" />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy || !aCat || !aBrand}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setAdjOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
