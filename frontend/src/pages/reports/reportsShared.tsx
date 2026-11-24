/** Общие хелперы страниц отчётов: форматирование и выбор периода.
 *  Логика агрегатов — на бэкенде; здесь только представление (стандарты §2.2).
 */

import { Select } from '../../components/ui'

export const fmt2 = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmt1 = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const monthLabel = (m: string) => {
  const [y, mo] = m.split('-')
  return `${mo}.${y}`
}

/** Выбор периода в месяцах для страниц отчётов. */
export function MonthsSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="w-40">
      <Select
        value={value}
        onChange={onChange}
        options={[
          { value: '6', label: '6 месяцев' },
          { value: '12', label: '12 месяцев' },
          { value: '24', label: '24 месяца' },
        ]}
      />
    </div>
  )
}
