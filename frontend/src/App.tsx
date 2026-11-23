import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'
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
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dictionaries" element={<Navigate to="/dictionaries/places" replace />} />
          <Route path="/dictionaries/places" element={<PlacesPage />} />
          <Route path="/dictionaries/vendors" element={<VendorsPage />} />
          <Route path="/dictionaries/buyers" element={<BuyersPage />} />
          <Route path="/dictionaries/feed" element={<FeedDictsPage />} />
          <Route path="/dictionaries/money-categories" element={<MoneyCategoriesPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/batches/:id" element={<BatchDetailPage />} />
          <Route path="/money" element={<MoneyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
