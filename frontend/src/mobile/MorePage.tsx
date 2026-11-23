/** Мобильная страница «Ещё»: все разделы, недошедшие до нижних вкладок,
 *  плюс переключатель «мобильная ⇄ полная (ПК)» версия. */

import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUiMode } from '../lib/uiMode'
import { navSections } from '../components/layout/Layout'
import { Card, Page } from '../components/ui'

export default function MorePage() {
  const { user } = useAuth()
  const { mode, setMode } = useUiMode()

  return (
    <Page title="Ещё">
      {navSections.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || user?.role === 'admin')
        if (items.length === 0) return null
        return (
          <div key={section.title} className="mt-3 first:mt-0">
            <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              {section.title}
            </p>
            <Card className="!p-0">
              {items.map((item, i) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block px-4 py-3 text-[15px] text-slate-700 active:bg-slate-50 ${
                    i > 0 ? 'border-t border-slate-100' : ''
                  }`}
                >
                  {item.label}
                  <span className="float-right text-slate-300">›</span>
                </Link>
              ))}
            </Card>
          </div>
        )
      })}

      <div className="mt-5">
        <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">Интерфейс</p>
        <Card className="!p-0">
          {mode === 'mobile' ? (
            <button
              onClick={() => setMode('desktop')}
              className="block w-full px-4 py-3 text-left text-[15px] text-slate-700 active:bg-slate-50"
            >
              🖥 Полная версия (для ПК)
            </button>
          ) : (
            <button
              onClick={() => setMode('mobile')}
              className="block w-full px-4 py-3 text-left text-[15px] text-slate-700 active:bg-slate-50"
            >
              📱 Мобильная версия
            </button>
          )}
          <button
            onClick={() => setMode('auto')}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-[15px] text-slate-700 active:bg-slate-50"
          >
            ⟳ Автоматически {mode === 'auto' && <span className="text-amber-600">(сейчас)</span>}
          </button>
        </Card>
        <p className="mt-2 px-1 text-xs text-slate-400">
          Обычно версия выбирается сама: узкий экран — мобильная, широкий — полная.
        </p>
      </div>
    </Page>
  )
}
