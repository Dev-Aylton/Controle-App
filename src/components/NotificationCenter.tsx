import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  sortNotificationsByPriority,
  type AppNotification,
  type AppNotificationCategory,
} from '../features/notifications/notificationCenter'

type NotificationCenterProps = {
  notifications: AppNotification[]
  onRead: (id: string) => void
  onDismiss: (id: string) => void
  onReadAll: () => void
  onDismissAll: () => void
}

export function NotificationCenter({
  notifications,
  onRead,
  onDismiss,
  onReadAll,
  onDismissAll,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [notificationSearch, setNotificationSearch] = useState('')
  const [notificationPage, setNotificationPage] = useState(1)
  const [notificationCategory, setNotificationCategory] = useState<'todas' | AppNotificationCategory>('todas')
  const notificationPageSize = 10
  const unreadCount = notifications.filter((notification) => !notification.read && !notification.dismissed).length
  const visible = notifications.filter((notification) => !notification.dismissed)
  const categoryLabels: Record<AppNotificationCategory, string> = {
    estoque: 'Estoque',
    movimentacoes: 'Movimentações',
    suporte: 'Suporte',
    sistema: 'Sistema',
  }
  const searchedNotifications = sortNotificationsByPriority(visible
    .filter((notification) => notificationCategory === 'todas' || notification.category === notificationCategory)
    .filter((notification) =>
      `${notification.title} ${notification.description}`.toLowerCase().includes(notificationSearch.toLowerCase().trim()),
    ))
  const categoryOptions = (['estoque', 'movimentacoes', 'suporte', 'sistema'] as AppNotificationCategory[])
    .filter((category) => visible.some((notification) => notification.category === category))
  const notificationPageCount = Math.max(1, Math.ceil(searchedNotifications.length / notificationPageSize))
  const visibleNotifications = searchedNotifications.slice((notificationPage - 1) * notificationPageSize, notificationPage * notificationPageSize)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        className="notification-bell"
        aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lida(s)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">●</span>
        {unreadCount > 0 && <strong>{unreadCount > 99 ? '99+' : unreadCount}</strong>}
      </button>
      {open && (
        <aside className="notification-panel" role="dialog" aria-modal="false" aria-label="Avisos que precisam de atenção">
          <header>
            <div>
              <small>Central de avisos</small>
              <h2>Notificações</h2>
            </div>
            {unreadCount > 0 && (
              <div className="notification-header-actions">
                <button type="button" className="notification-read-all" onClick={onReadAll}>Marcar todas como lidas</button>
                {visible.length > 0 && <button type="button" className="notification-dismiss-all" onClick={onDismissAll}>Dispensar todas</button>}
              </div>
            )}
          </header>
          <label className="notification-search">
            Buscar avisos
            <input value={notificationSearch} onChange={(event) => { setNotificationSearch(event.target.value); setNotificationPage(1) }} placeholder="Título ou descrição" />
          </label>
          {categoryOptions.length > 1 && (
            <div className="notification-category-tabs" aria-label="Categorias de notificação">
              <button
                type="button"
                className={notificationCategory === 'todas' ? 'active' : ''}
                onClick={() => { setNotificationCategory('todas'); setNotificationPage(1) }}
              >
                Todas <span>{visible.length}</span>
              </button>
              {categoryOptions.map((category) => {
                const count = visible.filter((notification) => notification.category === category).length
                return (
                  <button
                    type="button"
                    key={category}
                    className={notificationCategory === category ? 'active' : ''}
                    onClick={() => { setNotificationCategory(category); setNotificationPage(1) }}
                  >
                    {categoryLabels[category]} <span>{count}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="notification-list">
            {searchedNotifications.length === 0 ? (
              <p className="notification-empty">Nenhum aviso pendente. Tudo está em ordem.</p>
            ) : visibleNotifications.map((notification) => (
              <article
                className={`notification-item ${notification.severity}${notification.read ? ' is-read' : ''}`}
                key={notification.id}
              >
                <span className="notification-severity" aria-label={notification.severity === 'critical' ? 'Urgente' : notification.severity === 'warning' ? 'Atenção' : 'Informação'} />
                <div className="notification-copy">
                  <div className="notification-title-row">
                    <strong>{notification.title}</strong>
                    <span className={`notification-category ${notification.category}`}>{categoryLabels[notification.category]}</span>
                  </div>
                  <span className={`notification-urgency ${notification.severity}`}>
                    {notification.severity === 'critical' ? 'Urgente' : notification.severity === 'warning' ? 'Atenção' : 'Informação'}
                  </span>
                  <p>{notification.description}</p>
                </div>
                <div className="notification-actions">
                  <NavLink
                    to={notification.route}
                    onClick={() => {
                      onRead(notification.id)
                      setOpen(false)
                    }}
                  >
                    {notification.routeLabel}
                  </NavLink>
                  {!notification.read && (
                    <button type="button" onClick={() => onRead(notification.id)}>Marcar como lida</button>
                  )}
                  <button type="button" onClick={() => onDismiss(notification.id)}>Dispensar</button>
                </div>
              </article>
            ))}
          </div>
          {searchedNotifications.length > notificationPageSize && (
            <div className="notification-pagination">
              <button type="button" disabled={notificationPage <= 1} onClick={() => setNotificationPage((page) => Math.max(1, page - 1))}>Anterior</button>
              <span>{notificationPage}/{notificationPageCount}</span>
              <button type="button" disabled={notificationPage >= notificationPageCount} onClick={() => setNotificationPage((page) => Math.min(notificationPageCount, page + 1))}>Próxima</button>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
