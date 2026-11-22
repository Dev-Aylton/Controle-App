import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { NAVIGATION_ITEMS } from './navigation'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { Avatar } from './Avatar'
import { canManageCompany } from '../lib/uiPermissions'
import { getOfflineQueueStatus, syncQueuedMovements } from '../features/offline/sync'
import { formatAppVersion } from '../lib/appVersion'
import { AccountDrawer } from './AccountDrawer'
import { getAppVersion } from '../lib/appVersion'
import { checkPublishedVersion, isNewerVersion } from '../lib/versionCheck'
import { getMobileNavItems, getNavigationIconLabel } from './mobileNavigation'
import iconLight from '../../docs/logos/opcao-a/icon-light.svg'
import iconDark from '../../docs/logos/opcao-a/icon-dark.svg'
import { NavigationIcon } from './NavigationIcon'
import { PrivacyPolicyPrompt } from '../features/privacy/PrivacyPolicyPrompt'
import { recordTechnicalError } from '../lib/diagnostics'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const layout = useBreakpoint()
  const [tabletExpanded, setTabletExpanded] = useState(false)
  const { companies, activeCompany, selectCompany, role, isAdmin, error: companyError, clearError } = useCompanies()
  const { claimError, clearClaimError, user } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [offlineError, setOfflineError] = useState('')
  const appError = claimError || companyError || offlineError
  const [accountOpen, setAccountOpen] = useState(false)
  const [newVersion, setNewVersion] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let active = true
    const update = () => {
      setOnline(navigator.onLine)
      if (!user?.id) {
        setPendingCount(0)
        return
      }
      void getOfflineQueueStatus(user.id)
        .then(({ userPending }) => {
          if (!active) return
          setPendingCount(userPending)
          setOfflineError('')
        })
        .catch((error: unknown) => {
          if (!active) return
          setOfflineError('Não foi possível verificar os lançamentos salvos neste aparelho.')
          recordTechnicalError('AppShell.offlineQueue', error)
        })
      if (navigator.onLine) {
        void syncQueuedMovements(user.id)
          .then(() => getOfflineQueueStatus(user.id))
          .then(({ userPending }) => {
            if (active) {
              setPendingCount(userPending)
              setOfflineError('')
            }
          })
          .catch((error: unknown) => {
            if (!active) return
            setOfflineError('Não foi possível sincronizar os lançamentos salvos neste aparelho.')
            recordTechnicalError('AppShell.offlineSync', error)
          })
      }
    }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      active = false
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [user?.id])

  useEffect(() => {
    if (!moreOpen) return
    const previous = document.activeElement as HTMLElement | null
    moreRef.current?.querySelector<HTMLElement>('button,a')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
      if (event.key !== 'Tab' || !moreRef.current) return
      const items = [...moreRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [moreOpen])

  useEffect(() => {
    const check = async () => {
      if (!navigator.onLine) return
      try {
        const published = await checkPublishedVersion()
        if (isNewerVersion(getAppVersion(), published)) setNewVersion(published.version)
      } catch {
        // A falha de checagem não bloqueia o aplicativo.
      }
    }
    void check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  const footer = (
    <footer className="app-footer">
      <div className="app-footer-brand">
        <strong>Controle-App</strong>
        <span>{formatAppVersion()}</span>
      </div>
      <nav className="app-footer-links" aria-label="Links institucionais">
        <NavLink to="/privacidade">Aviso de Privacidade (minuta)</NavLink>
        <a className="footer-portfolio-button" href="https://dev-aylton.github.io/" target="_blank" rel="noreferrer">
          <span>Desenvolvido por</span>
          <strong>Aylton Alberto</strong>
        </a>
        <a className="footer-contact-button" href="mailto:desenvolvedor.aylton@gmail.com">
          Entrar em contato
        </a>
      </nav>
    </footer>
  )


  const visibleItems = NAVIGATION_ITEMS.filter((item) => {
    if ([
      '/equipe', '/estoque/saldo', '/alertas', '/compras', '/relatorios', '/auditoria', '/vendas/importar', '/vendas/precos',
    ].includes(item.path)) {
      return canManageCompany(role, isAdmin)
    }
    return true
  })
  const mobileItems = getMobileNavItems(role, isAdmin)

  if (layout === 'mobile') {
    return (
      <div className="app-shell app-shell-mobile">
        <header className="mobile-header">
          <span className="mobile-brand">Controle-App</span>
          <button className="profile-button profile-link" type="button" onClick={() => setAccountOpen(true)} aria-label="Minha conta">
            <Avatar name={user?.user_metadata.full_name ?? user?.email} googleUrl={user?.user_metadata.avatar_url} size={44} />
          </button>
        </header>
        <main className="app-content">
          {newVersion && <div className="update-toast" role="status">Nova versão disponível: v{newVersion}. Abra Minha conta para atualizar.</div>}
          {isAdmin && activeCompany && (
            <div className="app-error-banner" role="status">Modo suporte: suas ações ficam registradas.</div>
          )}
          {appError && (
            <div className="app-error-banner" role="alert">
              <span>{appError}</span>
              <button type="button" onClick={() => { clearClaimError(); clearError(); setOfflineError('') }}>Fechar</button>
            </div>
          )}
          {children}
          {footer}
        </main>
        <nav className="bottom-nav" aria-label="Navegação principal móvel">
          {mobileItems.map((item) => item.key === 'more'
            ? <button key={item.key} className="nav-link-button" type="button" onClick={() => setMoreOpen(true)}><span className="nav-icon" aria-hidden="true"><NavigationIcon label={getNavigationIconLabel(item.key)} /></span><span>Mais</span></button>
            : <NavLink key={item.key} to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon" aria-hidden="true"><NavigationIcon label={getNavigationIconLabel(item.key)} /></span><span>{item.label}</span>
              </NavLink>)}
        </nav>
        <AccountDrawer open={accountOpen} online={online} pendingCount={pendingCount} onClose={() => setAccountOpen(false)} />
        <PrivacyPolicyPrompt />
        {moreOpen && (
          <div className="mobile-more-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMoreOpen(false)
          }}>
            <aside className="mobile-more-drawer" ref={moreRef} role="dialog" aria-modal="true" aria-label="Mais opções">
              <button className="secondary-button" type="button" onClick={() => setMoreOpen(false)}>Fechar</button>
              {visibleItems.map((item) => (
                <NavLink key={item.path} to={item.path} onClick={() => setMoreOpen(false)}>{item.label}</NavLink>
              ))}
            </aside>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`app-shell app-shell-${layout}${tabletExpanded ? ' tablet-expanded' : ''}`}>
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="sidebar-access">
          <button
            className="tablet-menu-toggle"
            type="button"
            aria-label={tabletExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
            title={tabletExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
            onClick={() => setTabletExpanded((value) => !value)}
          >
            <span aria-hidden="true">{tabletExpanded ? '‹' : '☰'}</span>
          </button>
        </div>
        <NavLink to="/" className="sidebar-brand" aria-label="Controle-App — ir para o início" title="Controle-App — início">
          <img className="sidebar-brand-icon light-logo" src={iconLight} alt="" />
          <img className="sidebar-brand-icon dark-logo" src={iconDark} alt="" />
          <span className="sidebar-brand-copy">
            <strong>Controle-App</strong>
            <small>Gestão inteligente</small>
          </span>
        </NavLink>
        <nav className="side-nav">
          <span className="side-nav-heading" aria-hidden="true">Menu principal</span>
          {visibleItems.map((item) => (
            <NavLink key={item.path} to={item.path} title={item.label} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon" aria-hidden="true"><NavigationIcon label={item.label} /></span>
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
        <button className="profile-button profile-link" type="button" onClick={() => setAccountOpen(true)} aria-label="Minha conta">
          <Avatar name={user?.user_metadata.full_name ?? user?.email} googleUrl={user?.user_metadata.avatar_url} size={52} />
        </button>
      </header>
      <main className="app-content">
        {newVersion && <div className="update-toast" role="status">Nova versão disponível: v{newVersion}. Abra Minha conta para atualizar.</div>}
        {appError && (
          <div className="app-error-banner" role="alert">
            <span>{appError}</span>
            <button type="button" onClick={() => { clearClaimError(); clearError(); setOfflineError('') }}>Fechar</button>
          </div>
        )}
        {children}
        {footer}
      </main>
      <AccountDrawer open={accountOpen} online={online} pendingCount={pendingCount} onClose={() => setAccountOpen(false)} />
      <PrivacyPolicyPrompt />
    </div>
  )
}
