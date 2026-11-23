import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { AppNotification } from '../features/notifications/notificationCenter'

type NotificationCenterProps = {
  notifications: AppNotification[]
  onRead: (id: string) => void
  onDismiss: (id: string) => void
  onReadAll: () => void
}

export function NotificationCenter({
  notifications,
  onRead,
  onDismiss,
  onReadAll,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter((notification) => !notification.read && !notification.dismissed).length
  const visible = notifications.filter((notification) => !notification.dismissed)

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
              <button type="button" className="notification-read-all" onClick={onReadAll}>
                Marcar todas como lidas
              </button>
            )}
          </header>
          <div className="notification-list">
            {visible.length === 0 ? (
              <p className="notification-empty">Nenhum aviso pendente. Tudo está em ordem.</p>
            ) : visible.map((notification) => (
              <article
                className={`notification-item ${notification.severity}${notification.read ? ' is-read' : ''}`}
                key={notification.id}
              >
                <span className="notification-severity" aria-label={notification.severity === 'critical' ? 'Urgente' : notification.severity === 'warning' ? 'Atenção' : 'Informação'} />
                <div className="notification-copy">
                  <strong>{notification.title}</strong>
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
        </aside>
      )}
    </div>
  )
}
