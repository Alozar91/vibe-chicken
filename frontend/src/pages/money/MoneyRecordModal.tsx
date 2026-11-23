/** Модалка ручной записи журнала денег — общая для ПК- и мобильной версии. */

import { Button, DateInput, ErrorBox, Modal, Select, TextInput } from '../../components/ui'
import type { useMoneyJournal } from './useMoneyJournal'
import type { MoneyCategory, BroilerBatch } from '../../api/types'

type Journal = ReturnType<typeof useMoneyJournal>

export default function MoneyRecordModal({
  j,
  cats,
  batches,
}: {
  j: Journal
  cats: MoneyCategory[]
  batches: BroilerBatch[]
}) {
  return (
    <Modal
      open={j.modalOpen}
      title={j.editingId === null ? 'Новая запись' : 'Изменить запись'}
      onClose={() => j.setModalOpen(false)}
    >
      <ErrorBox message={j.formError} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void j.submit()
        }}
        className="mt-1 space-y-3"
      >
        <div className="w-full sm:w-48">
          <DateInput value={j.form.date} onChange={(v) => j.setForm({ ...j.form, date: v })} />
        </div>
        <Select
          value={j.form.kind}
          onChange={(v) =>
            j.setForm({ ...j.form, kind: v as 'income' | 'expense', money_category_id: '' })
          }
          options={[
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' },
          ]}
        />
        <Select
          value={j.form.money_category_id}
          onChange={(v) => j.setForm({ ...j.form, money_category_id: v })}
          options={[
            { value: '', label: 'Категория…' },
            ...cats.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />
        <div className="w-full sm:w-48">
          <TextInput
            value={j.form.amount}
            onChange={(v) => j.setForm({ ...j.form, amount: v })}
            placeholder="Сумма, ₽"
          />
        </div>
        <TextInput
          value={j.form.description}
          onChange={(v) => j.setForm({ ...j.form, description: v })}
          placeholder="Описание (необязательно)"
        />
        <Select
          value={j.form.batch_id}
          onChange={(v) => j.setForm({ ...j.form, batch_id: v })}
          options={[
            { value: '', label: 'Без привязки (общий расход)' },
            ...batches
              .filter((b) => b.status === 'active')
              .map((b) => ({ value: String(b.id), label: b.code })),
          ]}
        />
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={j.busy}>
            Сохранить
          </Button>
          <Button kind="secondary" onClick={() => j.setModalOpen(false)}>
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  )
}
