import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { getNavigationGroups } from './navigation'
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
import { BackToTop } from './BackToTop'
import { PrivacyPolicyPrompt } from '../features/privacy/PrivacyPolicyPrompt'
import { recordTechnicalError } from '../lib/diagnostics'
import { getPrivacyPolicyLinkLabel } from '../features/privacy/privacyPolicyStatus'
import { NotificationCenter } from './NotificationCenter'
import {
  getCompanyNotifications,
  loadNotificationState,
  saveNotificationState,
  type AppNotification,
} from '../features/notifications/notificationCenter'
import { getSupportUnreadCount } from '../features/support/supportService'
import { useProfilePhotoHidden } from '../features/account/useProfilePhotoHidden'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLElement>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const profilePhotoHidden = useProfilePhotoHidden(user?.id)

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
    if (!mobileMenuOpen) return
    const previous = document.activeElement as HTMLElement | null
    mobileMenuRef.current?.querySelector<HTMLElement>('button,select,a')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [mobileMenuOpen])

  useEffect(() => {
    let active = true
    if (!user?.id) {
      queueMicrotask(() => {
        if (active) setNotifications([])
      })
      return () => { active = false }
    }
    queueMicrotask(() => {
      void Promise.all([
        activeCompany?.id && canManageCompany(role, isAdmin)
          ? getCompanyNotifications(activeCompany.id)
          : Promise.resolve([]),
        getSupportUnreadCount(),
      ])
        .then(([items, supportUnread]) => {
          if (!active) return
          const stateCompanyId = activeCompany?.id ?? 'global'
          const state = loadNotificationState(stateCompanyId, user.id)
          const operational = items.map((item) => ({
            ...item,
            read: state.readIds.includes(item.id),
            dismissed: state.dismissedIds.includes(item.id),
          }))
          const next: AppNotification[] = []
          if (supportUnread > 0) {
            next.push({
              id: 'support:unread',
              severity: 'info',
              category: 'suporte',
              title: `${supportUnread} mensagem(ns) do suporte`,
              description: 'Abra a conversa com o administrador para ler a resposta.',
              route: '/suporte',
              routeLabel: 'Abrir suporte',
              read: state.readIds.includes('support:unread'),
              dismissed: state.dismissedIds.includes('support:unread'),
              createdAt: new Date().toISOString(),
            })
          }
          if (pendingCount > 0) {
            next.push({
              id: 'offline:pending',
              severity: 'info',
              category: 'movimentacoes',
              title: 'Lançamentos pendentes',
              description: `${pendingCount} lançamento(s) aguardam conexão ou sincronização.`,
              route: '/movimentacoes',
              routeLabel: 'Revisar lançamentos',
              read: state.readIds.includes('offline:pending'),
              dismissed: state.dismissedIds.includes('offline:pending'),
              createdAt: new Date().toISOString(),
            })
          }
          if (newVersion) {
            next.push({
              id: `version:${newVersion}`,
              severity: 'info',
              category: 'sistema',
              title: 'Nova versão disponível',
              description: `A versão ${newVersion} pode ser instalada pela sua conta.`,
              route: '/',
              routeLabel: 'Abrir Minha conta',
              read: state.readIds.includes(`version:${newVersion}`),
              dismissed: state.dismissedIds.includes(`version:${newVersion}`),
              createdAt: new Date().toISOString(),
            })
          }
          setNotifications([...operational, ...next])
        })
        .catch((error: unknown) => {
          if (!active) return
          recordTechnicalError('AppShell.notifications', error)
          setNotifications([])
        })
    })
    return () => { active = false }
  }, [activeCompany?.id, user?.id, role, isAdmin, pendingCount, newVersion])

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

  const persistNotificationState = (next: AppNotification[]) => {
    if (!activeCompany?.id || !user?.id) return
    saveNotificationState(activeCompany.id, user.id, {
      readIds: next.filter((item) => item.read).map((item) => item.id),
      dismissedIds: next.filter((item) => item.dismissed).map((item) => item.id),
    })
  }

  const readNotification = (id: string) => {
    setNotifications((current) => {
      const next = current.map((item) => item.id === id ? { ...item, read: true } : item)
      persistNotificationState(next)
      return next
    })
  }

  const dismissNotification = (id: string) => {
    setNotifications((current) => {
      const next = current.map((item) => item.id === id ? { ...item, dismissed: true } : item)
      persistNotificationState(next)
      return next
    })
  }

  const readAllNotifications = () => {
    setNotifications((current) => {
      const next = current.map((item) => item.dismissed ? item : { ...item, read: true })
      persistNotificationState(next)
      return next
    })
  }

  const dismissAllNotifications = () => {
    setNotifications((current) => {
      const next = current.map((item) => ({ ...item, dismissed: true }))
      persistNotificationState(next)
      return next
    })
  }

  const footer = (
    <footer className="app-footer">
      <div className="app-footer-brand">
        <strong>Controle-App</strong>
        <span>{formatAppVersion()}</span>
      </div>
      <nav className="app-footer-links" aria-label="Links institucionais">
        <NavLink className="footer-privacy-link" to="/privacidade">{getPrivacyPolicyLinkLabel()}</NavLink>
        <a className="footer-portfolio-button" href="https://dev-aylton.github.io/" target="_blank" rel="noreferrer">
          <span>Desenvolvido por</span>
          <strong>Aylton Alberto</strong>
        </a>
      </nav>
    </footer>
  )


  const navigationGroups = getNavigationGroups(role, isAdmin)
  const mobileItems = getMobileNavItems(role, isAdmin)

  if (layout === 'mobile') {
    return (
      <div className="app-shell app-shell-mobile">
        <header className="mobile-header">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label="Abrir menu lateral"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="dialog"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          {companies.length ? (
            <select
              className="company-selector mobile-company-selector"
              aria-label="Seletor de empresa"
              value={activeCompany?.id ?? ''}
              onChange={(event) => selectCompany(event.target.value)}
            >
              <option value="">Selecionar empresa</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          ) : (
            <NavLink className="company-selector mobile-company-selector" to="/entrar-codigo">Entrar com código</NavLink>
          )}
          <NotificationCenter
            notifications={notifications}
            onRead={readNotification}
            onDismiss={dismissNotification}
            onReadAll={readAllNotifications}
            onDismissAll={dismissAllNotifications}
          />
          <button className="profile-button profile-link" type="button" onClick={() => setAccountOpen(true)} aria-label="Minha conta">
            <Avatar key={user?.id + String(user?.user_metadata.avatar_url ?? '')} name={user?.user_metadata.full_name ?? user?.email} googleUrl={profilePhotoHidden ? null : user?.user_metadata.avatar_url} size={44} />
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
        <BackToTop />
        <nav className="bottom-nav" aria-label="Navegação principal móvel">
          {mobileItems.map((item) => item.key === 'more'
            ? <button
                key={item.key}
                className={`nav-link-button bottom-nav-more${mobileMenuOpen ? ' active' : ''}`}
                type="button"
                aria-expanded={mobileMenuOpen}
                aria-haspopup="dialog"
                onClick={() => setMobileMenuOpen(true)}
              >
                <span className="nav-icon" aria-hidden="true"><NavigationIcon label={getNavigationIconLabel(item.key)} /></span>
                <span>Mais</span>
              </button>
            : <NavLink key={item.key} to={item.path} className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon" aria-hidden="true"><NavigationIcon label={getNavigationIconLabel(item.key)} /></span><span>{item.label}</span>
              </NavLink>)}
        </nav>
        {mobileMenuOpen && (
          <div className="mobile-menu-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileMenuOpen(false)
          }}>
            <aside className="mobile-sidebar" ref={mobileMenuRef} role="dialog" aria-modal="true" aria-label="Menu lateral">
              <div className="mobile-sidebar-heading">
                <NavLink to="/" className="mobile-sidebar-brand" aria-label="Controle-App — ir para o início" onClick={() => setMobileMenuOpen(false)}>
                  <img className="mobile-sidebar-icon light-logo" src={iconLight} alt="" />
                  <img className="mobile-sidebar-icon dark-logo" src={iconDark} alt="" />
                  <span>Controle-App</span>
                </NavLink>
                <button className="secondary-button" type="button" onClick={() => setMobileMenuOpen(false)}>Fechar</button>
              </div>
              {companies.length ? (
                <select
                  className="company-selector mobile-sidebar-company"
                  aria-label="Seletor de empresa"
                  value={activeCompany?.id ?? ''}
                  onChange={(event) => selectCompany(event.target.value)}
                >
                  <option value="">Selecionar empresa</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              ) : (
                <NavLink className="company-selector mobile-sidebar-company" to="/entrar-codigo" onClick={() => setMobileMenuOpen(false)}>Entrar com código</NavLink>
              )}
              <button className="mobile-sidebar-profile" type="button" onClick={() => { setMobileMenuOpen(false); setAccountOpen(true) }}>
                <Avatar name={user?.user_metadata.full_name ?? user?.email} googleUrl={profilePhotoHidden ? null : user?.user_metadata.avatar_url} size={44} />
                <span><strong>Minha conta</strong><small>{isAdmin ? 'Administrador' : role === 'owner' ? 'Proprietário' : role === 'manager' ? 'Gerente' : role === 'employee' ? 'Funcionário' : 'Sem vínculo'}</small></span>
              </button>
              <nav className="mobile-sidebar-nav" aria-label="Navegação lateral móvel">
                {navigationGroups.map((group) => (
                  <section className="sidebar-nav-group" key={group.label}>
                    <strong>{group.label}</strong>
                    {group.items.map((item) => (
                      <NavLink key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                        <span className="nav-icon" aria-hidden="true"><NavigationIcon label={item.label} /></span>
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </section>
                ))}
              </nav>
            </aside>
          </div>
        )}
        <AccountDrawer open={accountOpen} online={online} pendingCount={pendingCount} onClose={() => setAccountOpen(false)} />
        <PrivacyPolicyPrompt />
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
          {navigationGroups.map((navGroup) => (
            <section className="sidebar-nav-group" key={navGroup.label}>
              <span className="side-nav-heading">{navGroup.label}</span>
              {navGroup.items.map((item) => (
                <NavLink key={item.path} to={item.path} title={item.label} className={({ isActive }) => isActive ? 'active' : ''}>
                  <span className="nav-icon" aria-hidden="true"><NavigationIcon label={item.label} /></span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </section>
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
        <NotificationCenter
          notifications={notifications}
          onRead={readNotification}
          onDismiss={dismissNotification}
          onReadAll={readAllNotifications}
          onDismissAll={dismissAllNotifications}
        />
        <button className="profile-button profile-link" type="button" onClick={() => setAccountOpen(true)} aria-label="Minha conta">
          <Avatar key={user?.id + String(user?.user_metadata.avatar_url ?? '')} name={user?.user_metadata.full_name ?? user?.email} googleUrl={profilePhotoHidden ? null : user?.user_metadata.avatar_url} size={52} />
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
      <BackToTop />
      <AccountDrawer open={accountOpen} online={online} pendingCount={pendingCount} onClose={() => setAccountOpen(false)} />
      <PrivacyPolicyPrompt />
    </div>
  )
}
