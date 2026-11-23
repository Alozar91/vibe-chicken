/** Карточка стада несушек: метрики + события. */

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { flockMetrics, getFlock } from '../../api/layers'
import type { FlockMetrics, LayFlock } from '../../api/types'
import { ErrorBox, Page } from '../../components/ui'
import { ChangeSection, CollectionSection, LayFeedingSection, SelfUseSection } from './flockSections'

export default function FlockDetailPage() {
  const { id } = useParams()
  const flockId = Number(id)

  const [flock, setFlock] = useState<LayFlock | null>(null)
  const [metrics, setMetrics] = useState<FlockMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [f, m] = await Promise.all([getFlock(flockId), flockMetrics(flockId)])
      setFlock(f)
      setMetrics(m)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    }
  }, [flockId])

  useEffect(() => {
    void load()
  }, [load])

  if (error && flock === null) {
    return (
      <Page title="Стадо">
        <ErrorBox message={error} />
        <Link to="/flocks" className="text-sm text-amber-700 hover:underline">
          ← к списку стад
        </Link>
      </Page>
    )
  }
  if (flock === null || metrics === null) return <Page title="Стадо">{null}</Page>

  const fmt = (n: number) =>
    n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmt2 = (n: number) =>
    n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const metric = (label: string, value: string) => (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
    </div>
  )

  return (
    <Page title={`${flock.name}${flock.status === 'closed' ? ' (закрыто)' : ''}`}>
      <Link to="/flocks" className="text-sm text-amber-700 hover:underline">
        ← к списку стад
      </Link>
      <ErrorBox message={error} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {metric('Поголовье', String(metrics.current_head))}
        {metric('Собрано яиц', String(metrics.eggs_total))}
        {metric('Яйценоскость (7 дн)', metrics.lay_rate_pct !== null ? `${metrics.lay_rate_pct} %` : '—')}
        {metric('Съели сами, шт', String(metrics.selfuse_total))}
        {metric('Продано десятков', String(metrics.dozens_sold))}
        {metric('Выручка за яйцо', `${fmt2(metrics.egg_revenue)} ₽`)}
        {metric('Корм съеден', `${fmt(metrics.feed_kg)} кг`)}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChangeSection flockId={flockId} onChanged={load} />
        <CollectionSection flockId={flockId} onChanged={load} />
        <LayFeedingSection flockId={flockId} onChanged={load} />
        <SelfUseSection flockId={flockId} onChanged={load} />
      </div>
    </Page>
  )
}
