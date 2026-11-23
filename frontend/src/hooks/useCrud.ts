/** Хук CRUD-логики справочника: загрузка, создание, правка, удаление, ошибки.
 *  Компонент остаётся чистым представлением (стандарты §2.2).
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

export interface CrudItem {
  id: number
  name: string
}

export function useCrud<T extends CrudItem, In>(
  load: () => Promise<T[]>,
  create: (data: In) => Promise<T>,
  update: (id: number, data: In) => Promise<T>,
  remove: (id: number) => Promise<void>,
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      setItems(await load())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const doCreate = useCallback(
    async (data: In): Promise<boolean> => {
      setError(null)
      try {
        await create(data)
        await refresh()
        return true
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Ошибка сохранения')
        return false
      }
    },
    [create, refresh],
  )

  const doUpdate = useCallback(
    async (id: number, data: In): Promise<boolean> => {
      setError(null)
      try {
        await update(id, data)
        await refresh()
        return true
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Ошибка сохранения')
        return false
      }
    },
    [update, refresh],
  )

  const doRemove = useCallback(
    async (id: number): Promise<boolean> => {
      setError(null)
      try {
        await remove(id)
        await refresh()
        return true
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Ошибка удаления')
        return false
      }
    },
    [remove, refresh],
  )

  return { items, loading, error, doCreate, doUpdate, doRemove, refresh }
}
