/** Мобильная оболочка: узкая шапка + фиксированное нижнее меню из 5 вкладок.
 *  Основные «полевые» разделы — вкладками; остальное — на странице «Ещё». */

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const tabs = [
  { to: '/', label: 'Сводка', icon: '🏠', end: true },
  { to: '/orders', label: 'Заказы', icon: '📋' },
  { to: '/routes', label: 'Маршруты', icon: '🚗' },
  { to: '/money', label: 'Деньги', icon: '💰' },
  { to: '/more', label: 'Ещё', icon: '⋯' },
]

export default function MobileLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  if (!user) return <Outlet />

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-lg font-bold text-slate-900">🐔 Vibe Chicken</span>
          <div className="flex items-center gap-2">
            {user.role === 'admin' && <span className="text-xs text-amber-600">владелец</span>}
            <button
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 active:bg-slate-100"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 pb-24 pt-3">
        <Outlet />
      </main>

      {/* нижние вкладки; отступ под «панель жестов» iPhone */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                isActive ? 'font-medium text-amber-600' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
