import { HomePage } from '../pages/HomePage'
import { AppShell } from '../components/AppShell'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { CompanyProvider } from '../features/company/CompanyContext'
import { ManagementRoute, ProtectedRoute } from '../features/auth/ProtectedRoute'
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
import { AlertsPage } from '../pages/AlertsPage'
import { PurchaseListPage } from '../pages/PurchaseListPage'
import { ReportPage } from '../pages/ReportPage'
import { AuditPage } from '../pages/AuditPage'
import { SalesImportPage } from '../pages/SalesImportPage'
import { SalesPricesPage } from '../pages/SalesPricesPage'
import { DemoPage } from '../pages/DemoPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { OfflinePage } from '../pages/OfflinePage'
import { ConfirmProvider } from '../components/ConfirmDialog'
import { AccountReactivationPage } from '../pages/AccountReactivationPage'
import { PrivacyPolicyPage } from '../features/privacy/PrivacyPolicyPage'

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/redefinir-senha" element={<LoginPage />} />
      <Route path="/privacidade" element={<PrivacyPolicyPage />} />
      <Route path="/reativar-conta" element={<AccountReactivationPage />} />
      <Route path="*" element={
        <ProtectedRoute>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/entrar-codigo" element={<JoinCompanyPage />} />
              <Route path="/empresa" element={<CompanyPage />} />
              <Route path="/equipe" element={<TeamPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/ambientes" element={<EnvironmentsPage />} />
              <Route path="/produtos" element={<ProductsPage />} />
              <Route path="/produtos/importar" element={<ProductImportPage />} />
              <Route path="/movimentacoes" element={<MovementsPage />} />
              <Route path="/estoque/saldo" element={<ManagementRoute><StockPage /></ManagementRoute>} />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route path="/alertas" element={<ManagementRoute><AlertsPage /></ManagementRoute>} />
              <Route path="/compras" element={<ManagementRoute><PurchaseListPage /></ManagementRoute>} />
              <Route path="/relatorios" element={<ManagementRoute><ReportPage /></ManagementRoute>} />
              <Route path="/auditoria" element={<ManagementRoute><AuditPage /></ManagementRoute>} />
              <Route path="/vendas/importar" element={<ManagementRoute><SalesImportPage /></ManagementRoute>} />
              <Route path="/vendas/precos" element={<ManagementRoute><SalesPricesPage /></ManagementRoute>} />
              <Route path="/configuracoes" element={<Navigate to="/perfil" replace />} />
              <Route path="/sem-conexao" element={<OfflinePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

function App() {
  const demoByMode = import.meta.env.VITE_DEMO_MODE === 'true'
  const demoByRoute = typeof window !== 'undefined' && window.location.hash.startsWith('#/demo')
  if (demoByMode || demoByRoute) return <DemoPage />
  return (
    <ConfirmProvider>
      <AuthProvider>
        <CompanyProvider>
          <AppContent />
        </CompanyProvider>
      </AuthProvider>
    </ConfirmProvider>
  )
}

export default App
