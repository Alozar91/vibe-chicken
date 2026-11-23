import { Page } from '../components/ui'

const plannedModules = [
  { icon: '🥚', title: 'Яйценоскость', desc: 'Сбор яйца, продажи десятками' },
  { icon: '🐔', title: 'Партии бройлеров', desc: 'Закупка, падёж, кормление, забой' },
  { icon: '🌾', title: 'Склад корма', desc: 'Закупки, расход, остатки' },
  { icon: '💰', title: 'Журнал денег', desc: 'Доходы и расходы' },
  { icon: '📊', title: 'Отчёты', desc: 'Экономика партий, P&L, конверсия' },
]

export default function DashboardPage() {
  return (
    <Page title="Дашборд">
      <p className="text-sm text-slate-500">
        Справочники уже работают. Остальные разделы появятся в следующих итерациях:
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plannedModules.map((m) => (
          <div key={m.title} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-2xl">{m.icon}</div>
            <h3 className="mt-2 font-semibold text-slate-900">{m.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
          </div>
        ))}
      </div>
    </Page>
  )
}
