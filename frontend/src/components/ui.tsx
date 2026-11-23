/** Общие UI-примитивы: только представление, без бизнес-логики (стандарты §2.2). */

import type { ReactNode } from 'react'

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p>
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>
}

export function Button({
  children,
  onClick,
  kind = 'primary',
  type = 'button',
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'secondary' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const styles = {
    primary: 'bg-amber-500 text-white hover:bg-amber-600',
    secondary: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
    danger: 'border border-red-300 text-red-600 hover:bg-red-50',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles[kind]}`}
    >
      {children}
    </button>
  )
}

/** Кнопка-иконка «подставить цену из справочника» (ценник).

Компактный квадрат вместо текстовой кнопки: стоит вплотную к полю цены
в формах продаж. Смысл — во всплывающей подсказке (title).
*/
export function PriceDictButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Цена из справочника"
      aria-label="Цена из справочника"
      className="flex h-[38px] w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:border-amber-400 hover:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r="0.5" fill="currentColor" />
      </svg>
    </button>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  required = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
    />
  )
}

/** Поле ввода даты: нативный календарь, отображение дд.мм.гггг. */
export function DateInput({
  value,
  onChange,
  required = false,
}: {
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <input
      type="date"
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
    />
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
      />
      {label}
    </label>
  )
}
