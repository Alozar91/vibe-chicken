/** Секция справочника: список + форма добавления/правки в модальном окне.
 *  Представление отдельно от логики (useCrud), модалка — UI-примитив.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Card, ErrorBox, Modal, TextInput } from '../../components/ui'
import type { CrudItem } from '../../hooks/useCrud'

interface SimpleCrudSectionProps<T extends CrudItem, In = string> {
  title: string
  items: T[]
  error: string | null
  onCreate: (input: In) => Promise<boolean>
  onUpdate: (id: number, input: In) => Promise<boolean>
  onRemove: (id: number) => Promise<boolean>
  /** преобразование имени в данные создания (для составных In) */
  toInput?: (name: string) => In
  /** дополнительное поле формы (например, селект вида места) */
  formExtra?: (mode: 'create' | 'edit', item: T | null) => ReactNode
  /** собрать полные данные для правки из записи и имени */
  toEditInput?: (item: T, name: string) => In
  /** необязательный слот для доп. колонок списка */
  renderExtra?: (item: T) => ReactNode
  namePlaceholder?: string
  /** подпись на кнопке добавления */
  addLabel?: string
}

export function SimpleCrudSection<T extends CrudItem, In = string>({
  title,
  items,
  error,
  onCreate,
  onUpdate,
  onRemove,
  toInput = (name) => name as unknown as In,
  formExtra,
  toEditInput,
  renderExtra,
  namePlaceholder = 'Название',
  addLabel = 'Добавить',
}: SimpleCrudSectionProps<T, In>) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (item: T) => {
    setEditing(item)
    setName(item.name)
    setFormError(null)
    setModalOpen(true)
  }

  const close = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    setFormError(null)
    const input =
      editing !== null
        ? toEditInput
          ? toEditInput(editing, name.trim())
          : toInput(name.trim())
        : toInput(name.trim())
    const ok = editing !== null ? await onUpdate(editing.id, input) : await onCreate(input)
    setBusy(false)
    if (ok) close()
    else setFormError('Не удалось сохранить. Возможно, такое название уже есть.')
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Button onClick={openCreate}>{addLabel}</Button>
      </div>
      <ErrorBox message={error} />

      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{item.name}</span>
            {renderExtra?.(item)}
            <Button kind="secondary" onClick={() => openEdit(item)}>
              Изменить
            </Button>
            <Button kind="danger" onClick={() => onRemove(item.id)} disabled={busy}>
              Удалить
            </Button>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-slate-400">Пока пусто</li>}
      </ul>

      <Modal
        open={modalOpen}
        title={editing === null ? `Новая запись — ${title}` : `Изменить — ${title}`}
        onClose={close}
      >
        <ErrorBox message={formError} />
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-1 space-y-3"
        >
          <TextInput value={name} onChange={setName} placeholder={namePlaceholder} required />
          {formExtra?.(editing === null ? 'create' : 'edit', editing)}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={close}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
