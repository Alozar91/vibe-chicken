import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Responsive from './components/Responsive'
import { AuthProvider, useAuth } from './context/AuthContext'
import MobileLayout from './mobile/MobileLayout'
import MorePage from './mobile/MorePage'
import MoneyMobile from './mobile/MoneyMobile'
import OrderDetailMobile from './mobile/OrderDetailMobile'
import BuyersPage from './pages/dictionaries/BuyersPage'
import MoneyCategoriesPage from './pages/dictionaries/MoneyCategoriesPage'
import VendorsPage from './pages/dictionaries/VendorsPage'
import PlacesPage from './pages/dictionaries/PlacesPage'
import FeedDictsPage from './pages/dictionaries/FeedDictsPage'
import FeedPage from './pages/feed/FeedPage'
import BatchesPage from './pages/broiler/BatchesPage'
import BatchDetailPage from './pages/broiler/BatchDetailPage'
import SettingsPage from './pages/SettingsPage'
import MoneyPage from './pages/money/MoneyPage'
import FlocksPage from './pages/layers/FlocksPage'
import FlockDetailPage from './pages/layers/FlockDetailPage'
import OrdersPage from './pages/orders/OrdersPage'
import OrderFormPage from './pages/orders/OrderFormPage'
import OrderDetailPage from './pages/orders/OrderDetailPage'
import ReportsPage from './pages/reports/ReportsPage'
import UsersPage from './pages/UsersPage'
import RoutesPage from './pages/routes/RoutesPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Загрузка…
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              {/* две версии интерфейса: мобильная — по ширине экрана или вручную (lib/uiMode) */}
              <Responsive desktop={<Layout />} mobile={<MobileLayout />} />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Responsive desktop={<DashboardPage />} />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/dictionaries" element={<Navigate to="/dictionaries/places" replace />} />
          <Route path="/dictionaries/places" element={<PlacesPage />} />
          <Route path="/dictionaries/vendors" element={<VendorsPage />} />
          <Route path="/dictionaries/buyers" element={<BuyersPage />} />
          <Route path="/dictionaries/feed" element={<FeedDictsPage />} />
          <Route path="/dictionaries/money-categories" element={<MoneyCategoriesPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/batches/:id" element={<BatchDetailPage />} />
          <Route path="/money" element={<Responsive desktop={<MoneyPage />} mobile={<MoneyMobile />} />} />
          <Route path="/flocks" element={<FlocksPage />} />
          <Route path="/flocks/:id" element={<FlockDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/new" element={<OrderFormPage />} />
          <Route path="/orders/:id" element={<Responsive desktop={<OrderDetailPage />} mobile={<OrderDetailMobile />} />} />
          <Route path="/orders/:id/edit" element={<OrderFormPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/routes" element={<RoutesPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
