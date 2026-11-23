/** Страница «Места содержания»: логика в useCrud, форма в модалке. */

import { useState } from 'react'
import { PLACE_KIND_LABELS } from '../../api/types'
import type { Place, PlaceKind } from '../../api/types'
import {
  createPlace,
  deletePlace,
  listPlaces,
  PLACE_KINDS,
  updatePlace,
} from '../../api/dictionaries'
import { Page, Select } from '../../components/ui'
import { SimpleCrudSection } from '../../components/dictionaries/SimpleCrudSection'
import { useCrud } from '../../hooks/useCrud'

export default function PlacesPage() {
  const [newKind, setNewKind] = useState<PlaceKind>('broiler_module')
  const [editKind, setEditKind] = useState<PlaceKind>('broiler_module')

  const places = useCrud<Place, Omit<Place, 'id'>>(
    listPlaces,
    (data) => createPlace(data),
    (id, data) => updatePlace(id, data),
    deletePlace,
  )

  return (
    <Page title="Места содержания">
      <div className="max-w-2xl">
        <SimpleCrudSection
          title="Места"
          items={places.items}
          error={places.error}
          onCreate={places.doCreate}
          onUpdate={places.doUpdate}
          onRemove={places.doRemove}
          namePlaceholder="Модуль 1"
          toInput={(name) => ({ name, kind: newKind, note: null })}
          toEditInput={(item, name) => ({ name, kind: editKind, note: item.note })}
          formExtra={(mode) => (
            <div className="w-full sm:w-56">
              <Select
                value={mode === 'edit' ? editKind : newKind}
                onChange={mode === 'edit' ? setEditKind : setNewKind}
                options={PLACE_KINDS}
              />
            </div>
          )}
          renderExtra={(p) => (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {PLACE_KIND_LABELS[p.kind]}
            </span>
          )}
        />
        <p className="mt-3 text-xs text-slate-400">
          Бройлерные модули — для партий; курятник — для стада несушек.
        </p>
      </div>
    </Page>
  )
}
