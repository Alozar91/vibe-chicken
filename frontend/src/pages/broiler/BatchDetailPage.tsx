/** Карточка партии: метрики (с бэкенда) + секции событий. */

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { batchMetrics, listBatches } from '../../api/broiler'
import type { BatchMetrics, BroilerBatch } from '../../api/types'
import { ErrorBox, Page } from '../../components/ui'
import { FeedingSection, MortalitySection, TreatmentSection, WeighingSection } from './eventSections'
import { SlaughtersSection, SalesSection } from './slaughterSales'

export default function BatchDetailPage() {
  const { id } = useParams()
  const batchId = Number(id)
  const [batch, setBatch] = useState<BroilerBatch | null>(null)
  const [metrics, setMetrics] = useState<BatchMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshMeta = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([listBatches(), batchMetrics(batchId)])
      setBatch(b.find((x) => x.id === batchId) ?? null)
      setMetrics(m)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    }
  }, [batchId])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  const metric = (label: string, value: string | null, danger = false) => (
    <div key={label} className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-semibold ${danger ? 'text-red-600' : 'text-slate-900'}`}>
        {value ?? 'нет данных'}
      </p>
    </div>
  )

  // возраст партии сегодня: дни с поступления + возраст при поступлении (§4.1)
  const batchAgeDays = (b: BroilerBatch) =>
    Math.max(0, Math.floor((Date.now() - new Date(b.start_date + 'T00:00:00').getTime()) / 86400000)) + b.arrival_age_days

  return (
    <Page title={batch ? `Партия ${batch.code}` : 'Партия'}>
      <ErrorBox message={error} />
      <Link to="/batches" className="text-sm text-amber-600 hover:underline">
        ← Все партии
      </Link>

      {batch && metrics && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {batch.status === 'active' && metric(
            'Возраст',
            `${batchAgeDays(batch)} дн (при поступлении ${batch.arrival_age_days})`,
          )}
          {metric('Поголовье сейчас', String(metrics.current_head))}
          {metric('Падёж', String(metrics.dead_head))}
          {metric('Забито', String(metrics.slaughtered_head))}
          {metric('Сохранность', metrics.survival_pct !== null ? `${metrics.survival_pct} %` : null)}
          {metric('FCR', metrics.fcr !== null ? String(metrics.fcr) : null)}
          {metric('Корм съеден', `${metrics.feed_kg} кг`)}
          {metric(
            'Живой вес (по забоям)',
            metrics.slaughtered_head > 0
              ? `${metrics.live_weight_kg} кг (ср. ${(metrics.live_weight_kg / metrics.slaughtered_head).toFixed(2)} кг/гол)`
              : `${metrics.live_weight_kg} кг`,
          )}
          {metric('Продукция (по забою)', `${metrics.output_kg} кг`)}
          {metric('Выход', metrics.output_pct !== null ? `${metrics.output_pct} %` : null)}
          {metric('Прямые затраты', `${metrics.direct_costs} ₽`)}
          {metric('Общие (доля)', metrics.shared_costs > 0 ? `${metrics.shared_costs} ₽` : null)}
          {metric('Выручка', `${metrics.revenue} ₽`)}
          {metric('Прибыль', metrics.profit !== null ? `${metrics.profit} ₽` : null, metrics.profit !== null && metrics.profit < 0)}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MortalitySection batchId={batchId} onChanged={refreshMeta} />
        <FeedingSection batchId={batchId} onChanged={refreshMeta} />
        <WeighingSection batchId={batchId} onChanged={refreshMeta} />
        <TreatmentSection batchId={batchId} onChanged={refreshMeta} />
        <SlaughtersSection batchId={batchId} onChanged={refreshMeta} />
        <SalesSection batchId={batchId} onChanged={refreshMeta} />
      </div>
    </Page>
  )
}
