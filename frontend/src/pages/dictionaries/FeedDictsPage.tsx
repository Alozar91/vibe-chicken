/** Страница «Корм и продукция»: категории, производители, виды продукции. */

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
  const productTypes = useCrud<ProductType, string>(
    listProductTypes,
    (name) => createProductType(name),
    (id, name) => updateProductType(id, name),
    deleteProductType,
  )

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
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Категории и производители нужны для учёта корма и сравнения конверсии (FCR); виды продукции —
        для выхода после забоя.
      </p>
    </Page>
  )
}
