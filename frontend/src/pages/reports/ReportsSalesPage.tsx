/** Отчёт «Продажи»: агрегация по видам продукции и по покупателям за период. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { buyersReport, productsReport } from '../../api/reports'
import type { BuyerRow, ProductRow } from '../../api/types'
import { Card, ErrorBox, Page } from '../../components/ui'
import Chart from '../../components/charts/Chart'
import { buyersOption } from './reportCharts'
import { MonthsSelect, fmt1, fmt2 } from './reportsShared'

const UNIT_LABEL: Record<string, string> = {
  kg: 'кг',
  pieces: 'шт',
  dozen: 'дес',
}

export default function ReportsSalesPage() {
  const [months, setMonths] = useState('12')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b] = await Promise.all([
        productsReport(Number(months)),
        buyersReport(Number(months)),
      ])
      setProducts(p)
      setBuyers(b)
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

  const buyersOpt = useMemo<EChartsOption>(() => buyersOption(buyers), [buyers])

  const productsTotal = products.reduce((s, r) => s + r.amount, 0)
  const buyersTotal = buyers.reduce((s, r) => s + r.total, 0)

  return (
    <Page title="Отчёты · Продажи">
      <ErrorBox message={error} />
      {loading && <p className="text-sm text-slate-400">Загрузка…</p>}

      <div className="mb-3 max-w-40">
        <MonthsSelect value={months} onChange={setMonths} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <h3 className="mb-2 font-semibold text-slate-900">
            Продажи по видам продукции
            <span className="ml-2 text-sm font-normal text-slate-400">
              всего {fmt2(productsTotal)} ₽
            </span>
          </h3>
          {products.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Пока нет продаж</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-2">Продукция</th>
                    <th className="pb-2 text-right">Продано</th>
                    <th className="pb-2 text-right">Продаж</th>
                    <th className="pb-2 text-right">Сумма</th>
                    <th className="pb-2 text-right">Доля</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((r) => (
                    <tr key={r.name} className="border-t border-slate-100">
                      <td className="py-2 pr-2 font-medium">{r.name}</td>
                      <td className="py-2 pr-2 text-right text-slate-600">
                        {r.unit === 'dozen'
                          ? `${r.dozen ?? 0} дес`
                          : `${fmt1(r.kg)} ${UNIT_LABEL[r.unit] ?? r.unit}`}
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-500">{r.sales_count}</td>
                      <td className="py-2 pr-2 text-right font-medium">{fmt2(r.amount)} ₽</td>
                      <td className="py-2 text-right text-slate-500">
                        {productsTotal > 0 ? `${Math.round((r.amount / productsTotal) * 100)} %` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Вес — по факту продаж (для тушек в штуках вес берётся по записям забоя/продажи);
            яйцо агрегируется отдельно (в десятках).
          </p>
        </Card>

        <Card className="xl:col-span-2">
          <h3 className="mb-2 font-semibold text-slate-900">
            Продажи по покупателям
            <span className="ml-2 text-sm font-normal text-slate-400">
              всего {fmt2(buyersTotal)} ₽
            </span>
          </h3>
          {buyers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Пока нет продаж</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-2">Покупатель</th>
                      <th className="pb-2 text-right">Бройлер</th>
                      <th className="pb-2 text-right">Яйцо</th>
                      <th className="pb-2 text-right">Сумма</th>
                      <th className="pb-2 text-right">Доля</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyers.map((b) => (
                      <tr key={`${b.buyer_id ?? 'none'}`} className="border-t border-slate-100">
                        <td className="py-2 pr-2 font-medium">{b.name}</td>
                        <td className="py-2 pr-2 text-right text-slate-600">
                          {b.broiler_kg > 0 ? `${fmt1(b.broiler_kg)} кг · ` : ''}{fmt2(b.broiler_amount)} ₽
                        </td>
                        <td className="py-2 pr-2 text-right text-slate-600">
                          {b.egg_dozens > 0 ? `${b.egg_dozens} дес · ` : ''}{fmt2(b.egg_amount)} ₽
                        </td>
                        <td className="py-2 pr-2 text-right font-medium">{fmt2(b.total)} ₽</td>
                        <td className="py-2 text-right text-slate-500">
                          {buyersTotal > 0 ? `${Math.round((b.total / buyersTotal) * 100)} %` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Chart option={buyersOpt} height={Math.max(200, buyers.length * 40 + 80)} />
              </div>
            </>
          )}
        </Card>
      </div>
    </Page>
  )
}
