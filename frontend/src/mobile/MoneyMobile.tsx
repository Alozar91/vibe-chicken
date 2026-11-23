/** Журнал денег (мобильная версия): записи карточками вместо таблицы.
 *  Логика и модалка — общие с ПК-версией (useMoneyJournal + MoneyRecordModal). */

import { useMoneyJournal, SOURCE_LABELS } from '../pages/money/useMoneyJournal'
import MoneyRecordModal from '../pages/money/MoneyRecordModal'
import { Button, Card, ErrorBox, Page } from '../components/ui'

export default function MoneyMobile() {
  const j = useMoneyJournal()

  return (
    <Page title="Журнал денег">
      {/* сводка одной строкой, крупными цифрами */}
      <Card className="!p-3">
        <div className="flex items-center justify-between text-center">
          <div className="flex-1">
            <p className="text-xs text-slate-400">Доходы</p>
            <p className="text-base font-semibold text-green-600">
              {j.summary ? `+${j.fmt(j.summary.income)}` : '…'}
            </p>
          </div>
          <div className="flex-1 border-x border-slate-100">
            <p className="text-xs text-slate-400">Расходы</p>
            <p className="text-base font-semibold text-red-600">
              {j.summary ? `−${j.fmt(j.summary.expense)}` : '…'}
            </p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400">Баланс</p>
            <p className={`text-base font-semibold ${j.summary && j.summary.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {j.summary ? j.fmt(j.summary.balance) : '…'}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={j.month}
            onChange={(e) => j.setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-base sm:text-sm"
          />
          {j.month && (
            <button onClick={() => j.setMonth('')} className="text-xs text-slate-400">
              сбросить
            </button>
          )}
        </div>
        <Button onClick={j.openCreate}>+ Запись</Button>
      </div>

      <ErrorBox message={j.error} />

      {/* карточки записей */}
      <div className="mt-3 space-y-2">
        {j.loading && <p className="text-sm text-slate-400">Загрузка…</p>}
        {!j.loading && j.items.length === 0 && (
          <Card><p className="text-sm text-slate-400">Записей пока нет</p></Card>
        )}
        {j.items.map((t) => (
          <Card key={t.id} className="!p-3">
            <div className="flex items-center gap-2">
              <span
                className={`whitespace-nowrap font-semibold ${
                  t.kind === 'income' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {t.kind === 'income' ? '+' : '−'} {j.fmt(t.amount)} ₽
              </span>
              {t.is_auto && (
                <span
                  title={t.source_type ? SOURCE_LABELS[t.source_type] ?? '' : ''}
                  className="text-xs text-slate-400"
                >
                  🔒
                </span>
              )}
              <div className="grow" />
              <span className="text-xs text-slate-400">
                {new Date(t.date + 'T00:00:00').toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-[15px] text-slate-900">
              {t.category_name}
              {t.batch_id && (
                <span className="text-slate-400">
                  {' '}
                  · {j.batches.find((b) => b.id === t.batch_id)?.code}
                </span>
              )}
            </p>
            {t.description && <p className="text-sm text-slate-500">{t.description}</p>}
            {!t.is_auto && (
              <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2">
                <button onClick={() => j.openEdit(t)} className="text-sm text-amber-600 active:opacity-60">
                  Изменить
                </button>
                <button
                  onClick={() => void j.remove(t.id)}
                  disabled={j.busy}
                  className="text-sm text-red-500 active:opacity-60"
                >
                  Удалить
                </button>
              </div>
            )}
          </Card>
        ))}
        {!j.loading && j.items.length > 0 && (
          <p className="px-1 text-xs text-slate-400">
            🔒 — авто-записи от событий: правятся в карточке партии или на складе.
          </p>
        )}
      </div>

      <MoneyRecordModal j={j} cats={j.catsForKind} batches={j.batches} />
    </Page>
  )
}
