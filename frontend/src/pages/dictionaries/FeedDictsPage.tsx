/** Страница «Корм и продукция»: категории, производители, виды продукции. */

import { useRef } from 'react'
import {
  createFeedBrand,
  createFeedCategory,
  createProductType,
  deleteFeedBrand,
  deleteFeedCategory,
  deleteProductType,
  listFeedBrands,
  listFeedCategories,
  listProductTypes,
  updateFeedBrand,
  updateFeedCategory,
  updateProductType,
} from '../../api/dictionaries'
import type { FeedBrand, FeedCategory, ProductType } from '../../api/types'
import { Page } from '../../components/ui'
import { SimpleCrudSection } from '../../components/dictionaries/SimpleCrudSection'
import { useCrud } from '../../hooks/useCrud'

export default function FeedDictsPage() {
  const feedCategories = useCrud<FeedCategory, string>(
    listFeedCategories,
    (name) => createFeedCategory(name),
    (id, name) => updateFeedCategory(id, name),
    deleteFeedCategory,
  )
  const feedBrands = useCrud<FeedBrand, string>(
    listFeedBrands,
    (name) => createFeedBrand(name),
    (id, name) => updateFeedBrand(id, name),
    deleteFeedBrand,
  )
  const productTypes = useCrud<ProductType, { name: string; unit: string }>(
    listProductTypes,
    (data) => createProductType(data.name, data.unit),
    (id, data) => updateProductType(id, data.name, data.unit),
    deleteProductType,
  )
  // unit в модалке видов продукции: значение выбирается в formExtra,
  // а подхватывается в toInput/toEditInput через ref
  const unitRef = useRef('kg')
  const setUnitRef = (v: string) => {
    unitRef.current = v
  }

  return (
    <Page title="Корм и продукция">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SimpleCrudSection
          title="Категории корма"
          items={feedCategories.items}
          error={feedCategories.error}
          onCreate={feedCategories.doCreate}
          onUpdate={feedCategories.doUpdate}
          onRemove={feedCategories.doRemove}
          namePlaceholder="Старт"
        />
        <SimpleCrudSection
          title="Производители корма"
          items={feedBrands.items}
          error={feedBrands.error}
          onCreate={feedBrands.doCreate}
          onUpdate={feedBrands.doUpdate}
          onRemove={feedBrands.doRemove}
          namePlaceholder="Производитель"
        />
        <SimpleCrudSection
          title="Виды продукции"
          items={productTypes.items}
          error={productTypes.error}
          onCreate={productTypes.doCreate}
          onUpdate={productTypes.doUpdate}
          onRemove={productTypes.doRemove}
          namePlaceholder="Тушка"
          toInput={(name) => ({ name, unit: unitRef.current })}
          toEditInput={(_item, name) => ({ name, unit: unitRef.current })}
          renderExtra={(item) => (
            <span className="text-xs text-slate-400">{item.unit === 'pieces' ? 'шт' : 'кг'}</span>
          )}
          formExtra={(_, editing) => (
            <UnitSelect value={editing ? editing.unit : unitRef.current} onChange={setUnitRef} />
          )}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Категории и производители нужны для учёта корма и сравнения конверсии (FCR); виды продукции —
        для выхода после забоя.
      </p>
    </Page>
  )
}



/** Селект единицы вида продукции: шт (тушка) или кг (остальное). */
function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-500">Единица продажи</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
      >
        <option value="kg">кг (на вес)</option>
        <option value="pieces">шт (поштучно, тушка)</option>
      </select>
    </label>
  )
}
