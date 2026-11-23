/** Хук загрузки справочников один раз (для селектов форм операций). */

import { useEffect, useState } from 'react'
import { listFeedBrands, listFeedCategories, listVendors } from '../api/dictionaries'
import type { FeedBrand, FeedCategory, Vendor, VendorType } from '../api/types'

export function useDictsForFeed() {
  const [categories, setCategories] = useState<FeedCategory[]>([])
  const [brands, setBrands] = useState<FeedBrand[]>([])
  const [feedVendors, setFeedVendors] = useState<Vendor[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [cats, brs, vendors] = await Promise.all([
          listFeedCategories(),
          listFeedBrands(),
          listVendors('feed' as VendorType),
        ])
        setCategories(cats)
        setBrands(brs)
        setFeedVendors(vendors) // только с тегом «Корм» (жёсткое правило)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки справочников')
      }
    })()
  }, [])

  return { categories, brands, feedVendors, error }
}
