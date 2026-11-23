/** Несушки: список стад + продажи яйца (глобальные). */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  closeFlock,
  createEggSale,
  createFlock,
  deleteEggSale,
  listEggSales,
  listFlocks,
  updateEggSale,
  updateFlock,
} from '../../api/layers'
import { getPrices, listBuyers, listPlaces } from '../../api/dictionaries'
import type { Buyer, EggSale, LayFlock, Place } from '../../api/types'
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

const emptyFlockForm = { name: '', place_id: '', start_date: '' }
const emptySaleForm = { date: '', dozens: '', price_per_ten: '', buyer_id: '', manual: false, total: '' }

export default function FlocksPage() {
  const [flocks, setFlocks] = useState<LayFlock[]>([])
  const [places, setPlaces] = useState<Place[]>([])
  const [sales, setSales] = useState<EggSale[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [flockModal, setFlockModal] = useState(false)
  const [editingFlock, setEditingFlock] = useState<LayFlock | null>(null)
  const [flockForm, setFlockForm] = useState(emptyFlockForm)
  const [flockError, setFlockError] = useState<string | null>(null)

  const [saleModal, setSaleModal] = useState(false)
  const [editingSale, setEditingSale] = useState<EggSale | null>(null)
  const [saleForm, setSaleForm] = useState(emptySaleForm)
  const [saleError, setSaleError] = useState<string | null>(null)
  const [saleHint, setSaleHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // кнопка «Цена из справочника»: цена яйца за десяток из настроек
  const applyEggDictPrice = async () => {
    setSaleError(null)
    try {
      const p = await getPrices()
      if (p.egg_price_per_ten == null) {
        setSaleHint('Цена яйца не задана — Настройки → «Цены продукции»')
        return
      }
      setSaleForm((prev) => ({ ...prev, price_per_ten: String(p.egg_price_per_ten) }))
      setSaleHint(null)
    } catch (e) {
      setSaleHint(e instanceof Error ? e.message : 'Ошибка загрузки справочника')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fs, ps, ss, bs] = await Promise.all([
        listFlocks(),
        listPlaces(),
        listEggSales(),
        listBuyers(),
      ])
      setFlocks(fs)
      setPlaces(ps)
      setSales(ss)
      setBuyers(bs)
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

  // --- стадо ---
  const openFlockCreate = () => {
    setEditingFlock(null)
    setFlockForm({ ...emptyFlockForm })
    setFlockError(null)
    setFlockModal(true)
  }

  const openFlockEdit = (f: LayFlock) => {
    setEditingFlock(f)
    setFlockForm({ name: f.name, place_id: String(f.place_id), start_date: f.start_date })
    setFlockError(null)
    setFlockModal(true)
  }

  const submitFlock = async () => {
    if (!flockForm.name.trim() || !flockForm.place_id || !flockForm.start_date) {
      setFlockError('Заполните название, место и дату')
      return
    }
    setBusy(true)
    try {
      const payload = {
        name: flockForm.name.trim(),
        place_id: Number(flockForm.place_id),
        start_date: flockForm.start_date,
      }
      if (editingFlock === null) await createFlock(payload)
      else await updateFlock(editingFlock.id, payload)
      setFlockModal(false)
      await load()
    } catch (e) {
      setFlockError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const doClose = async (id: number) => {
    if (!window.confirm('Закрыть стадо? События станут недоступны.')) return
    setBusy(true)
    try {
      await closeFlock(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  // --- продажи яйца ---
  const openSaleCreate = () => {
    setEditingSale(null)
    setSaleForm({ ...emptySaleForm })
    setSaleError(null)
    setSaleModal(true)
  }

  const openSaleEdit = (s: EggSale) => {
    setEditingSale(s)
    setSaleForm({
      date: s.date,
      dozens: String(s.dozens),
      price_per_ten: String(s.price_per_ten),
      buyer_id: s.buyer_id ? String(s.buyer_id) : '',
      manual: false,
      total: String(s.total_amount),
    })
    setSaleError(null)
    setSaleModal(true)
  }

  const submitSale = async () => {
    if (!saleForm.date || !saleForm.dozens || !saleForm.price_per_ten) {
      setSaleError('Заполните дату, десятки и цену')
      return
    }
    const dozens = Number(saleForm.dozens)
    const price = Number(saleForm.price_per_ten.replace(',', '.'))
    const total = saleForm.manual && saleForm.total.trim()
      ? Number(saleForm.total.replace(',', '.'))
      : null
    setBusy(true)
    try {
      const payload = {
        date: saleForm.date,
        dozens,
        price_per_ten: price,
        buyer_id: saleForm.buyer_id ? Number(saleForm.buyer_id) : null,
        total_amount: total,
      }
      if (editingSale === null) await createEggSale(payload)
      else await updateEggSale(editingSale.id, payload)
      setSaleModal(false)
      await load()
    } catch (e) {
      setSaleError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const removeSale = async (id: number) => {
    if (!window.confirm('Удалить продажу яйца?')) return
    setBusy(true)
    try {
      await deleteEggSale(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusy(false)
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const salesRevenue = sales.reduce((acc, s) => acc + s.total_amount, 0)

  return (
    <Page title="Несушки и яйцо">
      <ErrorBox message={error} />

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Стада несушек</h3>
          <Button onClick={openFlockCreate}>Новое стадо</Button>
        </div>
        {loading && <p className="mt-2 text-sm text-slate-400">Загрузка…</p>}
        {!loading && flocks.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Пока пусто — создайте стадо несушек
          </p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {flocks.map((f) => (
            <Card key={f.id} className={`!p-4 ${f.status === 'closed' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/flocks/${f.id}`} className="font-medium text-amber-700 hover:underline">
                  {f.name}
                </Link>
                <span className="text-xs text-slate-400">
                  {places.find((p) => p.id === f.place_id)?.name}
                </span>
                {f.status === 'closed' && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                    закрыто
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                с {new Date(f.start_date + 'T00:00:00').toLocaleDateString()}
              </p>
              <div className="mt-2 flex gap-2">
                <Link
                  to={`/flocks/${f.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Открыть
                </Link>
                <button
                  onClick={() => openFlockEdit(f)}
                  className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50"
                >
                  Изменить
                </button>
                {f.status === 'active' && (
                  <button
                    onClick={() => void doClose(f.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    Закрыть
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold text-slate-900">Продажи яйца</h3>
            {sales.length > 0 && (
              <span className="text-sm text-green-600">{fmt(salesRevenue)} ₽ всего</span>
            )}
          </div>
          <Button onClick={openSaleCreate}>Записать продажу</Button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Продажи яйца не привязаны к стаду (считаем одним хозяйством). Доход попадает в журнал денег автоматически.
        </p>
        {sales.length > 0 && (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-2">Дата</th>
                <th className="pb-2">Десятков</th>
                <th className="pb-2">Цена/10 шт</th>
                <th className="pb-2">Покупатель</th>
                <th className="pb-2 text-right">Сумма</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2">{new Date(s.date + 'T00:00:00').toLocaleDateString()}</td>
                  <td className="py-2 pr-2">{s.dozens}</td>
                  <td className="py-2 pr-2">{fmt(s.price_per_ten)} ₽</td>
                  <td className="py-2 pr-2 text-slate-500">
                    {s.buyer_id && buyers.find((b) => b.id === s.buyer_id)?.name}
                  </td>
                  <td className="py-2 pr-2 text-right font-medium text-green-600">
                    {fmt(s.total_amount)} ₽
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => openSaleEdit(s)} className="mr-2 text-xs text-amber-600 hover:underline">
                      изменить
                    </button>
                    <button onClick={() => void removeSale(s.id)} className="text-xs text-red-500 hover:underline">
                      удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* модалка стада */}
      <Modal
        open={flockModal}
        title={editingFlock === null ? 'Новое стадо' : 'Изменить стадо'}
        onClose={() => setFlockModal(false)}
      >
        <ErrorBox message={flockError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitFlock()
          }}
          className="mt-1 space-y-3"
        >
          <TextInput
            value={flockForm.name}
            onChange={(v) => setFlockForm({ ...flockForm, name: v })}
            placeholder="Название, например «Несушки-1»"
            required
          />
          <Select
            value={flockForm.place_id}
            onChange={(v) => setFlockForm({ ...flockForm, place_id: v })}
            options={[
              { value: '', label: 'Место…' },
              ...places.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
          <div className="w-full sm:w-48">
            <DateInput
              value={flockForm.start_date}
              onChange={(v) => setFlockForm({ ...flockForm, start_date: v })}
            />
          </div>
          <p className="text-xs text-slate-400">
            Поголовье задаётся событием «пополнение» в карточке стада.
          </p>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setFlockModal(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      {/* модалка продажи яйца */}
      <Modal
        open={saleModal}
        title={editingSale === null ? 'Продажа яйца' : 'Изменить продажу'}
        onClose={() => setSaleModal(false)}
      >
        <ErrorBox message={saleError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitSale()
          }}
          className="mt-1 space-y-3"
        >
          <div className="w-full sm:w-48">
            <DateInput
              value={saleForm.date}
              onChange={(v) => setSaleForm({ ...saleForm, date: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              value={saleForm.dozens}
              onChange={(v) => setSaleForm({ ...saleForm, dozens: v })}
              placeholder="Десятков"
            />
            <div className="flex items-start gap-2">
              <TextInput
                value={saleForm.price_per_ten}
                onChange={(v) => setSaleForm({ ...saleForm, price_per_ten: v })}
                placeholder="Цена за 10 шт, ₽"
              />
              <PriceDictButton onClick={() => void applyEggDictPrice()} />
            </div>
          </div>
          {saleHint && <p className="text-xs text-slate-400">{saleHint}</p>}
          <Select
            value={saleForm.buyer_id}
            onChange={(v) => setSaleForm({ ...saleForm, buyer_id: v })}
            options={[
              { value: '', label: 'Покупатель (необязательно)' },
              ...buyers.map((b) => ({ value: String(b.id), label: b.name })),
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={saleForm.manual}
              onChange={(e) => setSaleForm({ ...saleForm, manual: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ввести сумму чека вручную
          </label>
          {saleForm.manual && (
            <TextInput
              value={saleForm.total}
              onChange={(v) => setSaleForm({ ...saleForm, total: v })}
              placeholder="Сумма чека, ₽"
            />
          )}
          <p className="text-xs text-slate-400">
            Сумма по умолчанию: десятки × цена. Если отметите «вручную» — сохранится введённая.
          </p>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setSaleModal(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
