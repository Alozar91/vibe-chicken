/** Построители опций ECharts для отчётов (числа форматируются как в русском интерфейсе). */

import type { EChartsOption } from 'echarts'
import type { BuyerRow, CategorySlice, EggMonthPoint, MonthPoint } from '../../api/types'

const fmt = (n: number) => n.toLocaleString('ru-RU')

const palette = ['#d97706', '#16a34a', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6', '#f59e0b', '#6366f1']

const axisStyle = {
  axisLabel: { color: '#64748b' },
  splitLine: { lineStyle: { color: '#f1f5f9' } },
}

/** Ось X: подписи заметно ниже нулевой линии, сама ось всегда внизу сетки. */
const xAxisStyle = {
  ...axisStyle,
  axisLabel: { ...axisStyle.axisLabel, margin: 14 },
  onZero: false,
}

export function moneyMonthlyOption(points: MonthPoint[]): EChartsOption {
  return {
    color: ['#16a34a', '#ef4444', '#0ea5e9'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['Доходы', 'Расходы', 'Баланс'], textStyle: { color: '#475569' }, top: 0 },
    grid: { left: 56, right: 16, top: 48, bottom: 44 },
    xAxis: { type: 'category', data: points.map((p) => p.month), ...xAxisStyle },
    yAxis: { type: 'value', ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: fmt } },
    series: [
      { name: 'Доходы', type: 'bar', data: points.map((p) => p.income) },
      { name: 'Расходы', type: 'bar', data: points.map((p) => p.expense) },
      { name: 'Баланс', type: 'line', smooth: true, data: points.map((p) => p.balance) },
    ],
  }
}

export function categoryPieOption(slices: CategorySlice[], title: string): EChartsOption {
  const data = slices.map((s) => ({ name: s.name, value: s.total }))
  return {
    color: palette,
    tooltip: {
      trigger: 'item',
      valueFormatter: (v) => fmt(Number(v)) + ' ₽',
    },
    legend: { orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#475569', fontSize: 11 } },
    title: { text: title, left: 'center', textStyle: { color: '#334155', fontSize: 13 } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '55%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data,
      },
    ],
  }
}

export function eggsOption(points: EggMonthPoint[]): EChartsOption {
  return {
    color: ['#d97706', '#0ea5e9'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['Собрано, шт', 'Продано, десятков'], textStyle: { color: '#475569' }, top: 0 },
    grid: { left: 56, right: 16, top: 48, bottom: 44 },
    xAxis: { type: 'category', data: points.map((p) => p.month), ...xAxisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: [
      { name: 'Собрано, шт', type: 'bar', data: points.map((p) => p.collected) },
      { name: 'Продано, десятков', type: 'line', smooth: true, data: points.map((p) => p.dozens_sold) },
    ],
  }
}

export function buyersOption(rows: BuyerRow[]): EChartsOption {
  const sorted = [...rows].reverse()
  return {
    color: ['#d97706', '#16a34a'],
    tooltip: { trigger: 'axis', valueFormatter: (v) => fmt(Number(v)) + ' ₽' },
    legend: { data: ['Бройлер', 'Яйцо'], textStyle: { color: '#475569' } },
    grid: { left: 130, right: 24, top: 36, bottom: 28 },
    xAxis: { type: 'value', ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: fmt } },
    yAxis: {
      type: 'category',
      data: sorted.map((r) => r.name),
      axisLabel: { color: '#334155', width: 120, overflow: 'truncate' },
    },
    series: [
      { name: 'Бройлер', type: 'bar', stack: 's', data: sorted.map((r) => r.broiler_amount) },
      { name: 'Яйцо', type: 'bar', stack: 's', data: sorted.map((r) => r.egg_amount) },
    ],
  }
}
