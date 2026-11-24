/** Отчёт «Деньги»: по месяцам (доход/расход/баланс) + категории за месяц. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { categoriesReport, monthlyReport } from '../../api/reports'
import type { CategorySlice, MonthPoint } from '../../api/types'
import { Card, ErrorBox, Page, Select } from '../../components/ui'
import Chart from '../../components/charts/Chart'
import { categoryPieOption, moneyMonthlyOption } from './reportCharts'
import { MonthsSelect, monthLabel } from './reportsShared'

export default function ReportsMoneyPage() {
  const [months, setMonths] = useState('12')
  const [pieMonth, setPieMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [pieKind, setPieKind] = useState<'expense' | 'income'>('expense')
  const [money, setMoney] = useState<MonthPoint[]>([])
  const [cats, setCats] = useState<CategorySlice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, c] = await Promise.all([
        monthlyReport(Number(months)),
        categoriesReport(pieMonth),
      ])
      setMoney(m)
      setCats(c)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки отчёта')
    } finally {
      setLoading(false)
    }
  }, [months, pieMonth])

  useEffect(() => {
    void load()
  }, [load])

  const moneyOption = useMemo<EChartsOption>(() => moneyMonthlyOption(money), [money])
  const pieOption = useMemo<EChartsOption>(
    () => categoryPieOption(cats.filter((s) => s.kind === pieKind), pieKind === 'expense' ? 'Расходы' : 'Доходы'),
    [cats, pieKind],
  )

  return (
    <Page title="Отчёты · Деньги">
      <ErrorBox message={error} />
      {loading && <p className="text-sm text-slate-400">Загрузка…</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Деньги по месяцам</h3>
            <MonthsSelect value={months} onChange={setMonths} />
          </div>
          <Chart option={moneyOption} height={320} />
        </Card>

        <Card className="xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">По категориям</h3>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={pieMonth}
                onChange={(e) => setPieMonth(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-base sm:text-sm"
              />
              <div className="w-32">
                <Select
                  value={pieKind}
                  onChange={(v) => setPieKind(v as 'expense' | 'income')}
                  options={[
                    { value: 'expense', label: 'Расходы' },
                    { value: 'income', label: 'Доходы' },
                  ]}
                />
              </div>
            </div>
          </div>
          {cats.filter((s) => s.kind === pieKind).length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Нет записей за {monthLabel(pieMonth)}
            </p>
          ) : (
            <Chart option={pieOption} height={280} />
          )}
        </Card>
      </div>
    </Page>
  )
}
