/** Страница справочников: универсальный CRUD-редактор для простых списков.
 *  Представление отдельно от логики (useCrud), формы — минимальные.
 */

import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Card, ErrorBox, TextInput } from '../../components/ui'
import type { CrudItem } from '../../hooks/useCrud'

interface SimpleCrudSectionProps<T extends CrudItem, In = string> {
  title: string
  items: T[]
  error: string | null
  onCreate: (input: In) => Promise<boolean>
  onUpdate: (id: number, input: In) => Promise<boolean>
  onRemove: (id: number) => Promise<boolean>
  /** преобразование строки формы в данные создания/правки (для составных In) */
  toInput?: (name: string) => In
  /** необязательный слот для доп. колонок */
  renderExtra?: (item: T) => ReactNode
  namePlaceholder?: string
}

export function SimpleCrudSection<T extends CrudItem, In = string>({
  title,
  items,
  error,
  onCreate,
  onUpdate,
  onRemove,
  toInput = (name) => name as unknown as In,
  renderExtra,
  namePlaceholder = 'Название',
}: SimpleCrudSectionProps<T, In>) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)

  const submitNew = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    if (await onCreate(toInput(newName.trim()))) setNewName('')
    setBusy(false)
  }

  const submitEdit = async (id: number) => {
    if (!editName.trim()) return
    setBusy(true)
    if (await onUpdate(id, toInput(editName.trim()))) setEditingId(null)
    setBusy(false)
  }

  return (
    <Card>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ErrorBox message={error} />

      <form onSubmit={submitNew} className="mt-3 flex gap-2">
        <TextInput value={newName} onChange={setNewName} placeholder={namePlaceholder} required />
        <Button type="submit" disabled={busy}>
          Добавить
        </Button>
      </form>

      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
            {editingId === item.id ? (
              <>
                <div className="min-w-0 flex-1">
                  <TextInput value={editName} onChange={setEditName} required />
                </div>
                <Button onClick={() => submitEdit(item.id)} disabled={busy}>
                  Сохранить
                </Button>
                <Button kind="secondary" onClick={() => setEditingId(null)}>
                  Отмена
                </Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{item.name}</span>
                {renderExtra?.(item)}
                <Button
                  kind="secondary"
                  onClick={() => {
                    setEditingId(item.id)
                    setEditName(item.name)
                  }}
                >
                  Изменить
                </Button>
                <Button kind="danger" onClick={() => onRemove(item.id)} disabled={busy}>
                  Удалить
                </Button>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-sm text-slate-400">Пока пусто</li>}
      </ul>
    </Card>
  )
}
