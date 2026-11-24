import { lazy, Suspense } from 'react'
import { AppShell } from '../components/AppShell'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext'
import { CompanyProvider } from '../features/company/CompanyContext'
import { ManagementRoute, ProtectedRoute } from '../features/auth/ProtectedRoute'
import { DemoPage } from '../pages/DemoPage'
import { ConfirmProvider } from '../components/ConfirmDialog'

const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const JoinCompanyPage = lazy(() => import('../pages/JoinCompanyPage').then((module) => ({ default: module.JoinCompanyPage })))
const CompanyPage = lazy(() => import('../pages/CompanyPage').then((module) => ({ default: module.CompanyPage })))
const TeamPage = lazy(() => import('../pages/TeamPage').then((module) => ({ default: module.TeamPage })))
const ProfilePage = lazy(() => import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const MovementsPage = lazy(() => import('../pages/MovementsPage').then((module) => ({ default: module.MovementsPage })))
const StockPage = lazy(() => import('../pages/StockPage').then((module) => ({ default: module.StockPage })))
const InventoryPage = lazy(() => import('../pages/InventoryPage').then((module) => ({ default: module.InventoryPage })))
const EnvironmentsPage = lazy(() => import('../pages/EnvironmentsPage').then((module) => ({ default: module.EnvironmentsPage })))
const ProductsPage = lazy(() => import('../pages/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const ProductImportPage = lazy(() => import('../pages/ProductImportPage').then((module) => ({ default: module.ProductImportPage })))
const AlertsPage = lazy(() => import('../pages/AlertsPage').then((module) => ({ default: module.AlertsPage })))
const PurchaseListPage = lazy(() => import('../pages/PurchaseListPage').then((module) => ({ default: module.PurchaseListPage })))
const ReportPage = lazy(() => import('../pages/ReportPage').then((module) => ({ default: module.ReportPage })))
const AuditPage = lazy(() => import('../pages/AuditPage').then((module) => ({ default: module.AuditPage })))
const SalesImportPage = lazy(() => import('../pages/SalesImportPage').then((module) => ({ default: module.SalesImportPage })))
const SalesPricesPage = lazy(() => import('../pages/SalesPricesPage').then((module) => ({ default: module.SalesPricesPage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const OfflinePage = lazy(() => import('../pages/OfflinePage').then((module) => ({ default: module.OfflinePage })))
const AccountReactivationPage = lazy(() => import('../pages/AccountReactivationPage').then((module) => ({ default: module.AccountReactivationPage })))
const PrivacyPolicyPage = lazy(() => import('../features/privacy/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })))
const SupportPage = lazy(() => import('../pages/SupportPage').then((module) => ({ default: module.SupportPage })))

function AppContent() {
  return (
    <Suspense fallback={<main className="page-state">Carregando tela...</main>}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
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
              <Route path="/suporte" element={<SupportPage />} />
              <Route path="/ambientes" element={<EnvironmentsPage />} />
              <Route path="/produtos" element={<ProductsPage />} />
              <Route path="/produtos/importar" element={<ProductImportPage />} />
              <Route path="/movimentacoes" element={<MovementsPage />} />
              <Route path="/estoque/saldo" element={<StockPage />} />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route path="/alertas" element={<ManagementRoute><AlertsPage /></ManagementRoute>} />
              <Route path="/compras" element={<PurchaseListPage />} />
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
    </Suspense>
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
