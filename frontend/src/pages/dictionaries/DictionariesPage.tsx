/** Страница «Справочники»: простые списки одним экраном.
 *  Логика — в useCrud, представление — SimpleCrudSection (стандарты §2).
 */

import { MONEY_KIND_LABELS, PLACE_KIND_LABELS } from '../../api/types'
import {
  createFeedBrand,
  createFeedCategory,
  createPlace,
  createProductType,
  deleteFeedBrand,
  deleteFeedCategory,
  deletePlace,
  deleteProductType,
  listFeedBrands,
  listFeedCategories,
  listPlaces,
  listProductTypes,
  updateFeedBrand,
  updateFeedCategory,
  updatePlace,
  updateProductType,
} from '../../api/dictionaries'
import type { FeedBrand, FeedCategory, Place, ProductType } from '../../api/types'
import { Page } from '../../components/ui'
import { SimpleCrudSection } from '../../components/dictionaries/SimpleCrudSection'
import { useCrud } from '../../hooks/useCrud'

export default function DictionariesPage() {
  const places = useCrud<Place, Omit<Place, 'id'>>(
    listPlaces,
    (data) => createPlace(data),
    (id, data) => updatePlace(id, data),
    deletePlace,
  )
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
  const productTypes = useCrud<ProductType, string>(
    listProductTypes,
    (name) => createProductType(name),
    (id, name) => updateProductType(id, name),
    deleteProductType,
  )

  return (
    <Page title="Справочники">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SimpleCrudSection
          title="Места содержания"
          items={places.items}
          error={places.error}
          onCreate={places.doCreate}
          onUpdate={places.doUpdate}
          onRemove={places.doRemove}
          toInput={(name) => ({ name, kind: 'broiler_module' as const, note: null })}
          namePlaceholder="Модуль 1"
          renderExtra={(p) => (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {PLACE_KIND_LABELS[p.kind]}
            </span>
          )}
        />
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
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Деньги ({MONEY_KIND_LABELS.income}/{MONEY_KIND_LABELS.expense}), продавцы и покупатели — в
        соответствующих разделах.
      </p>
    </Page>
  )
}
