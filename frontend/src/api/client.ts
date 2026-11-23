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
 *
 * Идемпотентность: каждый POST/PUT/DELETE получает заголовок Idempotency-Key
 * (UUID). При сетевом сбое запрос повторяется один раз с тем же ключом —
 * сервер вернёт сохранённый ответ первого выполнения, дубль не создастся
 * (например, если продажа записалась, а ответ не дошёл).
 */
const API_BASE = import.meta.env.BASE_URL

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `k-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function doFetch(path: string, options: RequestInit, key: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (key) headers['Idempotency-Key'] = key
  return fetch(`${API_BASE}${path.replace(/^\//, '')}`, {
    credentials: 'include',
    headers,
    ...options,
  })
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers = {}, ...rest } = options
  const key = rest.method && rest.method !== 'GET' ? newIdempotencyKey() : null

  let res: Response
  try {
    res = await doFetch(path, rest, key)
  } catch (e) {
    // сетевой сбой: ответ мог и дойти — повторяем с тем же ключом,
    // сервер вернёт сохранённый результат вместо повторной операции
    if (key) {
      res = await doFetch(path, rest, key)
    } else {
      throw e
    }
  }

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
