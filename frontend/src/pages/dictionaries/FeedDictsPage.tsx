/** Страница «Корм и продукция»: категории, производители, виды продукции. */

import { useCallback, useEffect, useState } from 'react'
import {
  createFeedBrand,
  createFeedCategory,
  deleteFeedBrand,
  deleteFeedCategory,
  listFeedBrands,
  listFeedCategories,
  listProductTypes,
  updateFeedBrand,
  updateFeedCategory,
} from '../../api/dictionaries'
import type { FeedBrand, FeedCategory, ProductType } from '../../api/types'
import { Page } from '../../components/ui'
import { SimpleCrudSection } from '../../components/dictionaries/SimpleCrudSection'
import { ProductTypesSection } from '../../components/dictionaries/ProductTypesSection'
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
  const [productTypes, setProductTypes] = useState<ProductType[]>([])

  const loadProductTypes = useCallback(async () => {
    try {
      setProductTypes(await listProductTypes())
    } catch {
      /* ошибки покажет секция при действиях */
    }
  }, [])

  useEffect(() => {
    void loadProductTypes()
  }, [loadProductTypes])

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
        <ProductTypesSection items={productTypes} onChanged={() => void loadProductTypes()} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Категории и производители нужны для учёта корма и сравнения конверсии (FCR); виды продукции —
        для выхода после забоя и справочника цен.
      </p>
    </Page>
  )
}
