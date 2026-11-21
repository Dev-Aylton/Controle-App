import { useEffect, useState } from 'react'
import { HomePage } from '../pages/HomePage'
import { checkSupabaseConnection } from '../lib/supabase'
import { AppShell } from '../components/AppShell'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { CompanyProvider } from '../features/company/CompanyContext'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { LoginPage } from '../pages/LoginPage'
import { JoinCompanyPage } from '../pages/JoinCompanyPage'
import { CompanyPage } from '../pages/CompanyPage'
import { TeamPage } from '../pages/TeamPage'
import { ProfilePage } from '../pages/ProfilePage'
import { MovementsPage } from '../pages/MovementsPage'
import { StockPage } from '../pages/StockPage'
import { InventoryPage } from '../pages/InventoryPage'
import { EnvironmentsPage } from '../pages/EnvironmentsPage'
import { ProductsPage } from '../pages/ProductsPage'
import { ProductImportPage } from '../pages/ProductImportPage'

function AppContent() {
  const [status, setStatus] = useState('Verificando conexão com o Supabase...')

  useEffect(() => {
    const controller = new AbortController()

    checkSupabaseConnection(controller.signal)
      .then(() => setStatus('Conexão com o Supabase confirmada.'))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatus(`Erro de conexão com o Supabase: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
        }
      })

    return () => controller.abort()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/redefinir-senha" element={<LoginPage />} />
      <Route path="*" element={
        <ProtectedRoute>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage status={status} />} />
              <Route path="/entrar-codigo" element={<JoinCompanyPage />} />
              <Route path="/empresa" element={<CompanyPage />} />
              <Route path="/equipe" element={<TeamPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/ambientes" element={<EnvironmentsPage />} />
              <Route path="/produtos" element={<ProductsPage />} />
              <Route path="/produtos/importar" element={<ProductImportPage />} />
              <Route path="/movimentacoes" element={<MovementsPage />} />
              <Route path="/estoque/saldo" element={<StockPage />} />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route path="/alertas" element={<HomePage status={`Alertas — ${status}`} />} />
              <Route path="/configuracoes" element={<HomePage status={`Configurações — ${status}`} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <AppContent />
      </CompanyProvider>
    </AuthProvider>
  )
}

export default App
