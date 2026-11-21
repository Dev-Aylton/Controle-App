import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { NAVIGATION_ITEMS } from './navigation'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { Avatar } from './Avatar'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const layout = useBreakpoint()
  const [tabletExpanded, setTabletExpanded] = useState(false)
  const { companies, activeCompany, selectCompany, role, isAdmin, error: companyError, clearError } = useCompanies()
  const { signOut, claimError, clearClaimError, user } = useAuth()
  const appError = claimError || companyError

  const visibleItems = NAVIGATION_ITEMS.filter((item) => {
    if (item.path === '/equipe') return isAdmin || role === 'owner' || role === 'manager'
    return true
  })

  if (layout === 'mobile') {
    return (
      <div className="app-shell app-shell-mobile">
        <header className="mobile-header">
          <span className="mobile-brand">Controle-App</span>
          <NavLink className="profile-button profile-link" to="/perfil" aria-label="Perfil">
            <Avatar name={user?.user_metadata.full_name ?? user?.email} googleUrl={user?.user_metadata.avatar_url} size={44} />
          </NavLink>
        </header>
        <main className="app-content">
          {appError && (
            <div className="app-error-banner" role="alert">
              <span>{appError}</span>
              <button type="button" onClick={() => { clearClaimError(); clearError() }}>Fechar</button>
            </div>
          )}
          {children}
        </main>
        <nav className="bottom-nav" aria-label="Navegação principal">
          {visibleItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.shortLabel}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <div className={`app-shell app-shell-${layout}${tabletExpanded ? ' tablet-expanded' : ''}`}>
      <aside className="sidebar" aria-label="Navegação principal">
        <button
          className="tablet-menu-toggle"
          type="button"
          aria-label={tabletExpanded ? 'Recolher menu' : 'Expandir menu'}
          onClick={() => setTabletExpanded((value) => !value)}
        >
          ☰
        </button>
        <nav className="side-nav">
          {visibleItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <header className="desktop-header">
        {companies.length ? (
          <select
            className="company-selector"
            aria-label="Seletor de empresa"
            value={activeCompany?.id ?? ''}
            onChange={(event) => selectCompany(event.target.value)}
          >
            <option value="">Selecionar empresa</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        ) : (
          <NavLink className="company-selector" to="/entrar-codigo">Entrar com código</NavLink>
        )}
        <NavLink className="profile-button profile-link" to="/perfil" aria-label="Perfil">
          <Avatar name={user?.user_metadata.full_name ?? user?.email} googleUrl={user?.user_metadata.avatar_url} size={44} />
        </NavLink>
        <button className="logout-button" type="button" onClick={() => void signOut()}>Sair</button>
      </header>
      <main className="app-content">
        {appError && (
          <div className="app-error-banner" role="alert">
            <span>{appError}</span>
            <button type="button" onClick={() => { clearClaimError(); clearError() }}>Fechar</button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
