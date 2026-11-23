/** Секция «Виды продукции»: имя, единица (шт/кг), цена продажи по умолчанию.

Отдельный компонент (не SimpleCrudSection): у вида три поля вместо одного имени,
цена используется кнопкой «Цена из справочника» в формах продаж.
*/

import { useState } from 'react'
import { createProductType, deleteProductType, updateProductType } from '../../api/dictionaries'
import type { ProductType } from '../../api/types'
import { Button, Card, ErrorBox, Modal, Select, TextInput } from '../ui'

const emptyForm = { name: '', unit: 'kg', price: '' }

export function ProductTypesSection({
  items,
  onChanged,
}: {
  items: ProductType[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setOpen(true)
  }

  const openEdit = (t: ProductType) => {
    setEditingId(t.id)
    setForm({ name: t.name, unit: t.unit, price: t.sale_price != null ? String(t.sale_price) : '' })
    setError(null)
    setOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const raw = form.price.trim().replace(',', '.')
      const price = raw === '' ? null : Number(raw)
      if (raw !== '' && Number.isNaN(price)) throw new Error('Цена должна быть числом')
      if (editingId === null) {
        await createProductType(form.name.trim(), form.unit, price)
      } else {
        await updateProductType(editingId, form.name.trim(), form.unit, price)
      }
      setOpen(false)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm('Удалить вид продукции?')) return
    try {
      await deleteProductType(id)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления')
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Виды продукции</h3>
        <Button onClick={openCreate}>+</Button>
      </div>
      <ErrorBox message={error} />
      <ul className="mt-2 divide-y divide-slate-100">
        {items.map((t) => (
          <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 text-slate-700">
              {t.name}{' '}
              <span className="text-xs text-slate-400">
                {t.unit === 'pieces' ? 'шт' : 'кг'}
                {t.sale_price != null && ` · ${t.sale_price} ₽`}
              </span>
            </span>
            <button className="text-xs text-amber-600 hover:underline" onClick={() => openEdit(t)}>
              изменить
            </button>
            <button className="text-xs text-red-500 hover:underline" onClick={() => void remove(t.id)}>
              удалить
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="py-1.5 text-sm text-slate-400">Пока пусто</li>}
      </ul>

      <Modal
        open={open}
        title={editingId === null ? 'Новый вид продукции' : 'Изменить вид продукции'}
        onClose={() => setOpen(false)}
      >
        <ErrorBox message={error} />
        <div className="mt-1 space-y-3">
          <TextInput
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Название (Тушка, Печень…)"
            required
          />
          <Select
            value={form.unit}
            onChange={(v) => setForm({ ...form, unit: v })}
            options={[
              { value: 'kg', label: 'кг — продаётся на вес (потроха, печень)' },
              { value: 'pieces', label: 'шт — поштучно (тушка)' },
            ]}
          />
          <TextInput
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            placeholder={form.unit === 'pieces' ? 'Цена по умолчанию, ₽/шт' : 'Цена по умолчанию, ₽/кг'}
          />
          <p className="text-xs text-slate-400">
            Цена необязательна: она подставляется кнопкой «Цена из справочника» в формах продаж.
          </p>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => void submit()} disabled={busy || !form.name.trim()}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setOpen(false)}>
              Отмена
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
