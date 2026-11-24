/** Отчёт «Яйцо»: сбор, самопотребление, продажи по месяцам. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { eggsReport } from '../../api/reports'
import type { EggMonthPoint } from '../../api/types'
import { Card, ErrorBox, Page } from '../../components/ui'
import Chart from '../../components/charts/Chart'
import { eggsOption } from './reportCharts'
import { MonthsSelect } from './reportsShared'

export default function ReportsEggPage() {
  const [months, setMonths] = useState('12')
  const [eggs, setEggs] = useState<EggMonthPoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEggs(await eggsReport(Number(months)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки отчёта')
    } finally {
      setLoading(false)
    }
  }, [months])

  useEffect(() => {
    void load()
  }, [load])

  const eggsOpt = useMemo<EChartsOption>(() => eggsOption(eggs), [eggs])

  return (
    <Page title="Отчёты · Яйцо">
      <ErrorBox message={error} />
      {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Яйцо по месяцам</h3>
          <MonthsSelect value={months} onChange={setMonths} />
        </div>
        {eggs.every((p) => p.collected === 0 && p.dozens_sold === 0) ? (
          <p className="py-10 text-center text-sm text-slate-400">Нет данных о сборе яйца</p>
        ) : (
          <Chart option={eggsOpt} height={340} />
        )}
      </Card>
    </Page>
  )
}
