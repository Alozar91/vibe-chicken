import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const plannedModules = [
  { icon: '🥚', title: 'Яйценоскость', desc: 'Сбор яиц по дням и курятникам' },
  { icon: '🐔', title: 'Поголовье', desc: 'Породы, партии, падёж и выбраковка' },
  { icon: '🌾', title: 'Корма', desc: 'Закупки, расход, остатки' },
  { icon: '💰', title: 'Финансы', desc: 'Затраты и доходы' },
  { icon: '🏥', title: 'Здоровье', desc: 'Прививки и обработки' },
  { icon: '📊', title: 'Отчёты', desc: 'Аналитика по всем данным' },
]

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-bold text-slate-900">🐔 Vibe Chicken</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user.username}</span>
            <button
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <h2 className="text-xl font-semibold text-slate-900">Дашборд</h2>
        <p className="mt-1 text-sm text-slate-500">
          Каркас готов и работает. Разделы появятся в следующих итерациях:
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plannedModules.map((m) => (
            <div key={m.title} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="text-2xl">{m.icon}</div>
              <h3 className="mt-2 font-semibold text-slate-900">{m.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
