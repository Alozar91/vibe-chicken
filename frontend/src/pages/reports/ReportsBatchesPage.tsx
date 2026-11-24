/** Отчёт «Партии»: сравнение экономики партий бройлеров. */

import { useCallback, useEffect, useState } from 'react'
import { batchesReport } from '../../api/reports'
import type { BatchRow } from '../../api/types'
import { Card, ErrorBox, Page } from '../../components/ui'
import { fmt1, fmt2 } from './reportsShared'

export default function ReportsBatchesPage() {
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setBatches(await batchesReport())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки отчёта')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Page title="Отчёты · Партии">
      <ErrorBox message={error} />
      {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
      <Card>
        <h3 className="mb-2 font-semibold text-slate-900">Сравнение партий</h3>
        {batches.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Пока нет партий</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-2">Партия</th>
                  <th className="pb-2">Место</th>
                  <th className="pb-2 text-right">Сохранность</th>
                  <th className="pb-2 text-right">Конверсия</th>
                  <th className="pb-2 text-right">Корм</th>
                  <th className="pb-2 text-right">Затраты</th>
                  <th className="pb-2 text-right">Выручка</th>
                  <th className="pb-2 text-right">Прибыль</th>
                  <th className="pb-2 text-right">На голову</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2 font-medium">{b.code}</td>
                    <td className="py-2 pr-2 text-slate-500">{b.place_name}</td>
                    <td className="py-2 pr-2 text-right">
                      {b.survival_pct !== null ? `${b.survival_pct} %` : '—'}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {b.fcr !== null ? b.fcr : '—'}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {fmt1(b.feed_kg)} кг · {fmt2(b.feed_cost)} ₽
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {fmt2(b.direct_costs + b.shared_costs)} ₽
                    </td>
                    <td className="py-2 pr-2 text-right text-green-600">{fmt2(b.revenue)} ₽</td>
                    <td
                      className={`py-2 pr-2 text-right font-medium ${
                        b.profit === null
                          ? 'text-slate-400'
                          : b.profit >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                      }`}
                    >
                      {b.profit === null ? 'нет продаж' : `${fmt2(b.profit)} ₽`}
                    </td>
                    <td className="py-2 text-right">
                      {b.profit_per_head !== null ? `${fmt2(b.profit_per_head)} ₽` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Затраты = прямые (цыплята, лечение, корм по средней цене закупки) + доля общих расходов.
          Корм оценивается по средней цене кг закупок той же категории/производителя.
        </p>
      </Card>
    </Page>
  )
}
