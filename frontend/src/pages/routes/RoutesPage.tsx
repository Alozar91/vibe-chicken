/** Страница «Маршруты» (§4.8): сборка поездки из заказов, автопорядок
 *  объезда (кнопка «Построить»), ручная правка стрелками, сохранение.
 *  Навигация по маршруту — ссылка в Яндекс Карты с промежуточными точками.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listOrders } from '../../api/orders'
import { createRoute, deleteRoute, getRoute, listRoutes, previewRoute, updateRoute, yandexMapsUrl } from '../../api/routes'
import type { Order, PreviewOut, RouteDetail, RouteSummary } from '../../api/types'
import { Button, Card, CheckboxRow, ErrorBox, Modal, Page, TextInput } from '../../components/ui'

/** Дата в формате YYYY-MM-DD по местному времени (toISOString даёт UTC — к вечеру врёт на день). */
function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 5400 → «1 ч 30 мин»; 355 → «6 мин». */
function fmtDur(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  return `${h} ч ${m % 60 ? `${m % 60} мин` : ''}`.trim()
}

function fmtKm(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [preselectedIds, setPreselectedIds] = useState<number[] | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const refresh = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([listRoutes(), listOrders()])
      setRoutes(r)
      setOrders(o.filter((x) => x.status !== 'cancelled'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openNew = () => {
    setEditingId(null)
    setEditorOpen(true)
  }

  // переход с заказа (?orders=3) — сразу редактор с предвыбранным заказом
  useEffect(() => {
    const raw = searchParams.get('orders')
    if (!raw) return
    const ids = raw.split(',').map(Number).filter((x) => Number.isFinite(x) && x > 0)
    if (ids.length > 0) {
      setEditingId(null)
      setPreselectedIds(ids)
      setEditorOpen(true)
    }
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEdit = (id: number) => {
    setEditingId(id)
    setEditorOpen(true)
  }

  const removeRoute = async (id: number) => {
    try {
      await deleteRoute(id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  return (
    <Page title="Маршруты">
      <ErrorBox message={error} />
      <div className="flex justify-end">
        <Button onClick={openNew}>+ Новая поездка</Button>
      </div>

      <div className="mt-3 space-y-3">
        {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
        {!loading && routes.length === 0 && (
          <p className="text-sm text-slate-400">
            Поездок пока нет. Соберите первую: выберите заказы → «Построить маршрут».
          </p>
        )}
        {routes.map((r) => (
          <RouteCard key={r.id} route={r} onEdit={() => openEdit(r.id)} onDelete={() => void removeRoute(r.id)} />
        ))}
      </div>

      {editorOpen && (
        <RouteEditor
          editingId={editingId}
          preselectedIds={preselectedIds}
          orders={orders}
          onClose={() => setEditorOpen(false)}
          onSaved={async () => {
            setEditorOpen(false)
            await refresh()
          }}
        />
      )}
    </Page>
  )
}

// --- карточка сохранённого маршрута ---

function RouteCard({ route, onEdit, onDelete }: { route: RouteSummary; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">{route.name}</div>
          <div className="text-sm text-slate-500">
            Остановок: {route.stops.length}
            {route.created_at && ` · ${new Date(route.created_at).toLocaleDateString('ru-RU')}`}
          </div>
          <ol className="mt-1 list-inside list-decimal text-sm text-slate-600">
            {route.stops.map((s) => (
              <li key={s.id}>{s.label}</li>
            ))}
          </ol>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button onClick={onEdit}>Открыть</Button>
          <Button kind="danger" onClick={onDelete}>
            Удалить
          </Button>
        </div>
      </div>
    </Card>
  )
}

// --- редактор поездки (создание и правка) ---

function RouteEditor({
  editingId,
  preselectedIds,
  orders,
  onClose,
  onSaved,
}: {
  editingId: number | null
  preselectedIds: number[] | null
  orders: Order[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(preselectedIds ?? []))
  // фильтр по дате заказа: по умолчанию последний месяц, старьё не тянем
  const [dateFrom, setDateFrom] = useState(localDate(new Date(Date.now() - 30 * 86400000)))
  const [dateTo, setDateTo] = useState(localDate(new Date()))
  const [preview, setPreview] = useState<PreviewOut | null>(null)
  const [detail, setDetail] = useState<RouteDetail | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editingId === null) return
    void (async () => {
      try {
        const d = await getRoute(editingId)
        setDetail(d)
        setName(d.name)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      }
    })()
  }, [editingId])

  const toggleOrder = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const build = async () => {
    setBusy(true)
    setError(null)
    try {
      setPreview(await previewRoute([...selected]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка построения')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const source = detail
      ? detail.stops.map((s) => ({ buyer_id: s.buyer_id, label: s.label, lat: s.lat, lon: s.lon, note: s.note, order_ids: s.order_ids }))
      : preview?.stops
    if (!source || source.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const payload = { name: name.trim() || undefined, stops: source }
      if (editingId !== null) await updateRoute(editingId, payload)
      else await createRoute(payload)
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const moveStop = (idx: number, dir: -1 | 1) => {
    const setter = detail ? setDetail : preview ? (p: unknown) => setPreview(p as PreviewOut) : null
    if (!setter) return
    if (detail) {
      const stops = [...detail.stops]
      const [x] = stops.splice(idx, 1)
      stops.splice(idx + dir, 0, x)
      setDetail({ ...detail, stops })
    } else if (preview) {
      const stops = [...preview.stops]
      const [x] = stops.splice(idx, 1)
      stops.splice(idx + dir, 0, x)
      setPreview({ ...preview, stops })
    }
  }

  const farm = detail ? { lat: detail.farm_lat, lon: detail.farm_lon } : preview ? { lat: preview.farm_lat, lon: preview.farm_lon } : null
  const stopsForMap = detail ? detail.stops : preview?.stops ?? []
  const totalSeconds = detail ? detail.total_seconds : preview?.total_seconds ?? 0
  const totalMeters = detail ? detail.total_meters : preview?.total_meters ?? 0
  const approximate = detail ? detail.approximate : preview?.approximate ?? false
  const noCoords = preview?.no_coords_buyers ?? []

  return (
    <Modal open onClose={onClose} title={editingId !== null ? 'Поездка' : 'Новая поездка'} wide>
      <ErrorBox message={error} />

      {editingId === null && !preview && (
        <div>
          <p className="text-sm text-slate-500">Выберите заказы для развоза:</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Дата с</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-base sm:text-sm"
            />
            <span>по</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-base sm:text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
              className="text-xs text-amber-600 hover:underline"
            >
              показать все
            </button>
          </div>
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2">
            {orders.length === 0 && <p className="text-sm text-slate-400">Заказов нет</p>}
            {(() => {
              const visible = orders.filter((o) => {
                if (dateFrom && o.date < dateFrom) return false
                if (dateTo && o.date > dateTo) return false
                return true
              })
              const hidden = orders.length - visible.length
              return (
                <>
                  {visible.length === 0 && <p className="text-sm text-slate-400">За период заказов нет</p>}
                  {hidden > 0 && (
                    <p className="px-2 pb-1 text-xs text-slate-400">
                      Скрыто старых заказов: {hidden} (кнопка «показать все»)
                    </p>
                  )}
                  {visible.map((o) => (
              <div key={o.id}>
                <CheckboxRow
                  label={`${o.buyer.name} · ${new Date(o.date).toLocaleDateString('ru-RU')}`}
                  hint={o.buyer.lat === null ? 'нет координат у покупателя' : undefined}
                  checked={selected.has(o.id)}
                  onChange={() => toggleOrder(o.id)}
                />
                {o.status === 'done' && (
                  <span className="ml-6 text-xs text-slate-400">уже выполнен (продажи оформлены)</span>
                )}
              </div>
                  ))}
                </>
              )
            })()}
          </div>
          <div className="mt-3">
            <Button onClick={() => void build()} disabled={busy || selected.size === 0}>
              Построить маршрут
            </Button>
          </div>
        </div>
      )}

      {(preview !== null || detail !== null) && (
        <div>
          {preview && noCoords.length > 0 && (
            <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Нет координат: {noCoords.join(', ')}. Добавьте их в справочнике покупателей —
              эти заказы в маршрут не попали.
            </div>
          )}

          <div className="space-y-2">
            {stopsForMap.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">{s.label}</div>
                  {s.order_ids.length > 0 && (
                    <div className="text-xs text-slate-500">заказы №{s.order_ids.join(', №')}</div>
                  )}
                  {s.note && <div className="text-xs text-slate-400">{s.note}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0} className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600 disabled:opacity-30" title="Выше">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveStop(i, 1)} disabled={i === stopsForMap.length - 1} className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600 disabled:opacity-30" title="Ниже">
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Итого в пути: <b>{fmtDur(totalSeconds)}</b>
            {totalMeters > 0 && <> · {fmtKm(totalMeters)}</>}
            {approximate && <> <span className="text-amber-600">(приблизительно, по прямой)</span></>}
          </div>

          {farm && farm.lat !== null && farm.lon !== null && stopsForMap.length > 0 && (
            <a
              href={yandexMapsUrl({ lat: farm.lat!, lon: farm.lon! }, stopsForMap)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block rounded-xl bg-amber-500 p-3 text-center font-medium text-white transition hover:bg-amber-600"
            >
              Открыть в Яндекс Картах
            </a>
          )}

          <div className="mt-4 space-y-2">
            <TextInput value={name} onChange={setName} placeholder="Название поездки (необязательно)" />
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={busy || stopsForMap.length === 0}>
                Сохранить
              </Button>
              <Button kind="secondary" onClick={onClose}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
