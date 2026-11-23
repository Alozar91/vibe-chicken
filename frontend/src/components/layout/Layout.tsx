import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/', label: 'Дашборд' },
  { to: '/dictionaries', label: 'Справочники' },
  { to: '/dictionaries/vendors', label: 'Продавцы' },
  { to: '/dictionaries/buyers', label: 'Покупатели' },
  { to: '/dictionaries/money-categories', label: 'Категории денег' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return <Outlet />

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm transition ${
      isActive ? 'bg-amber-100 font-medium text-amber-800' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-bold text-slate-900">🐔 Vibe Chicken</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">{user.username}</span>
            <button
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Выйти
            </button>
            {/* бургер для мобильных */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm sm:hidden"
              aria-label="Меню"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6">
        <nav className="hidden w-48 shrink-0 space-y-1 sm:block">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {menuOpen && (
          <nav className="fixed inset-x-4 top-16 z-10 space-y-1 rounded-xl bg-white p-3 shadow-lg sm:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                end={item.to === '/'}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
