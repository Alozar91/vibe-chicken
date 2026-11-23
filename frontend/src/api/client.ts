export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Базовый клиент API: куки сессии отправляются автоматически (credentials),
 * в dev-режиме /api проксируется Vite на FastAPI.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers = {}, ...rest } = options

  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...rest,
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { detail?: string } | null

    // Сессия истекла — отправляем на логин (кроме самих auth-запросов)
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      window.location.href = '/login'
    }

    throw new ApiError(res.status, data?.detail ?? `Ошибка запроса (${res.status})`)
  }

  // 204 No Content (DELETE) и другие пустые ответы — тела нет
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  // 204 No Content (DELETE) и другие пустые ответы — тела нет
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await res.json()) as T
}
