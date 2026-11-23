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
