import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navSections: { title: string; items: { to: string; label: string }[] }[] = [
  {
    title: 'Справочники',
    items: [
      { to: '/dictionaries/places', label: 'Места' },
      { to: '/dictionaries/vendors', label: 'Продавцы' },
      { to: '/dictionaries/buyers', label: 'Покупатели' },
      { to: '/dictionaries/feed', label: 'Корм и продукция' },
      { to: '/dictionaries/money-categories', label: 'Категории денег' },
    ],
  },
  {
    title: 'Учёт',
    items: [
      { to: '/feed', label: 'Склад корма' },
      { to: '/batches', label: 'Партии бройлеров' },
      { to: '/settings', label: 'Настройки' },
    ],
  },
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
          <NavLink to="/" className="text-lg font-bold text-slate-900 hover:text-amber-600">
            🐔 Vibe Chicken
          </NavLink>
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
          <NavLink to="/" className={linkClass} end>
            Дашборд
          </NavLink>
          {navSections
            .filter((s) => 'title' in s)
            .map((section) => (
              <div key={section.title} className="pt-3">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </p>
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
        </nav>

        {menuOpen && (
          <nav className="fixed inset-x-4 top-16 z-10 space-y-1 rounded-xl bg-white p-3 shadow-lg sm:hidden">
            <NavLink to="/" className={linkClass} end onClick={() => setMenuOpen(false)}>
              Дашборд
            </NavLink>
            {navSections
              .filter((s) => 'title' in s)
              .flatMap((section) => section.items)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={linkClass}
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
