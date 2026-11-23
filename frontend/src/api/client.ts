export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Базовый клиент API: куки сессии отправляются автоматически (credentials).
 * Пути собираются от import.meta.env.BASE_URL: в dev это «/» (/api проксируется
 * Vite на FastAPI), в проде — «/chicken/» (сборка с BASE_PATH, docs/deploy.md).
 */
const API_BASE = import.meta.env.BASE_URL

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers = {}, ...rest } = options

  const res = await fetch(`${API_BASE}${path.replace(/^\//, '')}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...rest,
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { detail?: string } | null

    // Сессия истекла — отправляем на логин (кроме самих auth-запросов)
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      window.location.href = `${API_BASE}login`
    }

    throw new ApiError(res.status, data?.detail ?? `Ошибка запроса (${res.status})`)
  }

  // 204 No Content (DELETE) и другие пустые ответы — тела нет
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await res.json()) as T
}
