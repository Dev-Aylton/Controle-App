import { useEffect, useRef } from 'react'

type Props = {
  userPending: number
  hasUnassignedPending: boolean
  busy: boolean
  error: string
  onWait: () => void
  onTrySend: () => void
  onDiscard: () => void
}

export function PendingQueueExitDialog({
  userPending,
  hasUnassignedPending,
  busy,
  error,
  onWait,
  onTrySend,
  onDiscard,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onWait()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const buttons = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')]
      if (!buttons.length) return
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault()
        buttons[buttons.length - 1].focus()
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault()
        buttons[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [busy, onWait])

  return (
    <div className="confirm-backdrop" role="presentation">
      <div className="confirm-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="pending-exit-title">
        <h2 id="pending-exit-title">Lançamentos offline</h2>
        {userPending > 0 ? (
          <p>Há {userPending} lançamentos aguardando envio. Aguarde a sincronização ou descarte-os e saia.</p>
        ) : (
          <p>Há lançamentos antigos sem conta vinculada. Por segurança, eles não serão exibidos nem enviados.</p>
        )}
        {hasUnassignedPending && userPending > 0 && (
          <p>Também existem registros antigos sem conta vinculada; eles não serão exibidos nem enviados.</p>
        )}
        <p>Escolha como deseja continuar:</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="member-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={onWait}>Aguardar</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={onTrySend}>Tentar enviar agora</button>
          <button className="danger-button" type="button" disabled={busy} onClick={onDiscard}>Descartar e sair</button>
        </div>
      </div>
    </div>
  )
}
