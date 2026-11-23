/** Журнал денег (ПК): авто-записи событий (только чтение) + ручные доходы/расходы.
 *  Общие расходы — ручные записи в категориях с флагом «общая»; они распределяются
 *  по кура-дням между партиями (доля показывается на карточке партии).
 *  Логика — в useMoneyJournal; мобильная версия — MoneyMobile. */

import { useMoneyJournal, SOURCE_LABELS } from './useMoneyJournal'
import MoneyRecordModal from './MoneyRecordModal'
import { Button, Card, ErrorBox, Page } from '../../components/ui'

export default function MoneyPage() {
  const j = useMoneyJournal()

  return (
    <Page title="Журнал денег">
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400">Доходы</p>
          <p className="text-base font-semibold text-green-600 sm:text-lg">
            {j.summary ? `+ ${j.fmt(j.summary.income)} ₽` : '…'}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400">Расходы</p>
          <p className="text-base font-semibold text-red-600 sm:text-lg">
            {j.summary ? `− ${j.fmt(j.summary.expense)} ₽` : '…'}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400">Баланс</p>
          <p className={`text-lg font-semibold ${j.summary && j.summary.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {j.summary ? `${j.fmt(j.summary.balance)} ₽` : '…'}
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">Записи</h3>
            <input
              type="month"
              value={j.month}
              onChange={(e) => j.setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-base sm:text-sm"
            />
            {j.month && (
              <button onClick={() => j.setMonth('')} className="text-xs text-slate-400 hover:text-slate-600">
                сбросить
              </button>
            )}
          </div>
          <Button onClick={j.openCreate}>Добавить запись</Button>
        </div>
        <ErrorBox message={j.error} />
        <p className="mt-1 text-xs text-slate-400">
          🔒 — авто-записи от событий (закупка цыплят, корм, лечение, продажи): правятся в карточке партии или на складе.
          Ручные записи в «общих» категориях (электричество и т.п.) распределяются по кура-дням.
        </p>
      </Card>

      <Card className="mt-4 overflow-x-auto">
        {j.loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : j.items.length === 0 ? (
          <p className="text-sm text-slate-400">Записей пока нет</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-2">Дата</th>
                <th className="pb-2">Категория</th>
                <th className="pb-2">Описание</th>
                <th className="pb-2">Партия</th>
                <th className="pb-2 text-right">Сумма</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {j.items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-2">
                    {t.category_name}
                    {t.is_auto && (
                      <span
                        title={t.source_type ? SOURCE_LABELS[t.source_type] ?? '' : ''}
                        className="ml-1 text-slate-400"
                      >
                        🔒
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">{t.description}</td>
                  <td className="py-2 pr-2 text-slate-500">
                    {t.batch_id && j.batches.find((b) => b.id === t.batch_id)?.code}
                  </td>
                  <td
                    className={`py-2 pr-2 text-right whitespace-nowrap font-medium ${
                      t.kind === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {t.kind === 'income' ? '+' : '−'} {j.fmt(t.amount)} ₽
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {t.is_auto ? (
                      <span className="text-xs text-slate-300">авто</span>
                    ) : (
                      <>
                        <button
                          onClick={() => j.openEdit(t)}
                          className="mr-2 text-xs text-amber-600 hover:underline"
                        >
                          изменить
                        </button>
                        <button
                          onClick={() => void j.remove(t.id)}
                          disabled={j.busy}
                          className="text-xs text-red-500 hover:underline"
                        >
                          удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <MoneyRecordModal j={j} cats={j.catsForKind} batches={j.batches} />
    </Page>
  )
}
