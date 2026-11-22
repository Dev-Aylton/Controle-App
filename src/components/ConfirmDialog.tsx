import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmContext, type ConfirmOptions } from './confirmContext'

type Confirmation = ConfirmOptions & { resolve: (confirmed: boolean) => void }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [typed, setTyped] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const confirm = useCallback((options: Omit<Confirmation, 'resolve'>) => (
    new Promise<boolean>((resolve) => {
      setTyped('')
      setConfirmation({ ...options, resolve })
    })
  ), [])
  const close = useCallback((confirmed: boolean) => {
    if (!confirmation) return
    if (confirmed && confirmation.requireText && typed !== confirmation.requireText) return
    confirmation.resolve(confirmed)
    setConfirmation(null)
  }, [confirmation, typed])

  useEffect(() => {
    if (!confirmation) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = panelRef.current?.querySelector<HTMLElement>('button,input')
    focusable?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [close, confirmation])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {confirmation && (
        <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close(false)
        }}>
          <div className="confirm-dialog" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            {confirmation.requireText && (
              <label>Digite {confirmation.requireText}
                <input value={typed} onChange={(event) => setTyped(event.target.value)} />
              </label>
            )}
            <div className="member-actions">
              <button className="secondary-button" type="button" onClick={() => close(false)}>Cancelar</button>
              <button
                className="danger-button"
                disabled={Boolean(confirmation.requireText && typed !== confirmation.requireText)}
                type="button"
                onClick={() => close(true)}
              >{confirmation.confirmLabel ?? 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
