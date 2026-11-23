/** Страница «Пользователи» (только админ — concept §6):
 * создание членов семьи, смена паролей и ролей, отключение.
 */

import { useCallback, useEffect, useState } from 'react'
import { createUser, listUsers, updateUser, type UserFull } from '../api/users'
import { Button, Card, ErrorBox, Modal, Page, Select, TextInput } from '../components/ui'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Владелец',
  user: 'Член семьи',
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')

export default function UsersPage() {
  const [users, setUsers] = useState<UserFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [isActive, setIsActive] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openCreate = () => {
    setEditingId(null)
    setUsername('')
    setPassword('')
    setRole('user')
    setIsActive(true)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (u: UserFull) => {
    setEditingId(u.id)
    setUsername(u.username)
    setPassword('')
    setRole(u.role)
    setIsActive(u.is_active)
    setFormError(null)
    setModalOpen(true)
  }

  const submit = async () => {
    setBusy(true)
    setFormError(null)
    try {
      if (editingId !== null) {
        // при редактировании пароль меняем только если введён новый
        await updateUser(editingId, {
          username: username.trim(),
          ...(password.trim() ? { password: password.trim() } : {}),
          role,
          is_active: isActive,
        })
      } else {
        await createUser({ username: username.trim(), password: password.trim(), role })
      }
      setModalOpen(false)
      await refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Пользователи">
      <ErrorBox message={error} />
      <div className="flex justify-end">
        <Button onClick={openCreate}>+ Пользователь</Button>
      </div>

      <Card className="mt-3">
        {loading ? (
          <p className="text-sm text-slate-500">Загрузка…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400">Пока нет пользователей</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => openEdit(u)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-amber-50"
              >
                <div>
                  <div className="font-medium text-slate-900">
                    {u.username}
                    {!u.is_active && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        отключён
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {ROLE_LABEL[u.role] ?? u.role} · с {fmtDate(u.created_at)}
                  </div>
                </div>
                <span className="text-sm text-amber-600">изменить</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Члены семьи имеют полный доступ к данным. Отключённый пользователь не может войти,
        его записи сохраняются. Пароль члена семьи можно сменить в любой момент.
      </p>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId !== null ? 'Изменить пользователя' : 'Новый пользователь'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="space-y-3"
        >
          <ErrorBox message={formError} />
          <TextInput value={username} onChange={setUsername} placeholder="Имя для входа" required />
          <TextInput
            value={password}
            onChange={setPassword}
            placeholder={editingId !== null ? 'Новый пароль (необязательно)' : 'Пароль (минимум 4 символа)'}
            required={editingId === null}
          />
          <Select
            value={role}
            onChange={setRole}
            options={[
              { value: 'user', label: 'Член семьи (полный доступ к данным)' },
              { value: 'admin', label: 'Владелец (плюс управление пользователями)' },
            ]}
          />
          {editingId !== null && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              Активен (может входить)
            </label>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={busy || !username.trim()}>
              Сохранить
            </Button>
            <Button kind="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
