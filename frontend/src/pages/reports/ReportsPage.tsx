/** Отчёты: деньги по месяцам, категории, яйцо, покупатели, сравнение партий. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import {
  batchesReport,
  buyersReport,
  categoriesReport,
  eggsReport,
  monthlyReport,
} from '../../api/reports'
import type { BatchRow, BuyerRow, CategorySlice, EggMonthPoint, MonthPoint } from '../../api/types'
import { Card, ErrorBox, Page, Select } from '../../components/ui'
import Chart from '../../components/charts/Chart'
import {
  buyersOption,
  categoryPieOption,
  eggsOption,
  moneyMonthlyOption,
} from './reportCharts'

const fmt2 = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt1 = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-')
  return `${mo}.${y}`
}

export default function ReportsPage() {
  const [months, setMonths] = useState('12')
  const [pieMonth, setPieMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [pieKind, setPieKind] = useState<'expense' | 'income'>('expense')

  const [money, setMoney] = useState<MonthPoint[]>([])
  const [cats, setCats] = useState<CategorySlice[]>([])
  const [eggs, setEggs] = useState<EggMonthPoint[]>([])
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, c, e, b, bt] = await Promise.all([
        monthlyReport(Number(months)),
        categoriesReport(pieMonth),
        eggsReport(6),
        buyersReport(Number(months)),
        batchesReport(),
      ])
      setMoney(m)
      setCats(c)
      setEggs(e)
      setBuyers(b)
      setBatches(bt)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки отчётов')
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
  const eggsOpt = useMemo<EChartsOption>(() => eggsOption(eggs), [eggs])
  const buyersOpt = useMemo<EChartsOption>(() => buyersOption(buyers), [buyers])

  return (
    <Page title="Отчёты">
      <ErrorBox message={error} />
      {loading && <p className="text-sm text-slate-400">Загрузка…</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Деньги по месяцам</h3>
            <div className="w-40">
              <Select
                value={months}
                onChange={setMonths}
                options={[
                  { value: '6', label: '6 месяцев' },
                  { value: '12', label: '12 месяцев' },
                  { value: '24', label: '24 месяца' },
                ]}
              />
            </div>
          </div>
          <Chart option={moneyOption} height={320} />
        </Card>

        <Card>
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

        <Card>
          <h3 className="mb-2 font-semibold text-slate-900">Яйцо по месяцам</h3>
          {eggs.every((p) => p.collected === 0 && p.dozens_sold === 0) ? (
            <p className="py-10 text-center text-sm text-slate-400">Нет данных о сборе яйца</p>
          ) : (
            <Chart option={eggsOpt} height={280} />
          )}
        </Card>

        <Card className="xl:col-span-2">
          <h3 className="mb-2 font-semibold text-slate-900">Продажи по покупателям</h3>
          {buyers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Пока нет продаж</p>
          ) : (
            <Chart option={buyersOpt} height={Math.max(200, buyers.length * 40 + 80)} />
          )}
        </Card>

        <Card className="xl:col-span-2">
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
      </div>
    </Page>
  )
}
