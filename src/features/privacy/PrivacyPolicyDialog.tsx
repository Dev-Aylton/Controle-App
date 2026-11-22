import { useEffect, useRef } from 'react'
import { PrivacyPolicyContent } from './PrivacyPolicyContent'
import {
  focusFirstPrivacyPolicyDialogControl,
  handlePrivacyPolicyDialogKeydown,
} from './privacyPolicyKeyboard'

type Props = {
  open: boolean
  policyVersion: string
  busy: boolean
  acceptError: string
  onDismiss: () => void
  onAccept: () => void
}

export function PrivacyPolicyDialog({
  open,
  policyVersion,
  busy,
  acceptError,
  onDismiss,
  onAccept,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open || !dialogRef.current) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a')]
    focusFirstPrivacyPolicyDialogControl(focusable)
    const onKey = (event: KeyboardEvent) => {
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a') ?? [])]
      handlePrivacyPolicyDialogKeydown(
        event,
        document.activeElement,
        items[0] ?? null,
        items[items.length - 1] ?? null,
        onDismiss,
      )
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onDismiss, open])

  if (!open) return null

  return (
    <div
      className="privacy-policy-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <section
        className="privacy-policy-dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-policy-dialog-title"
      >
        <button
          className="privacy-policy-close"
          type="button"
          onClick={onDismiss}
          aria-label="Ler a política depois"
        >
          Fechar
        </button>
        <p className="privacy-policy-dialog-intro">
          Há uma nova versão ({policyVersion}) do aviso. Você pode fechar este aviso e continuar
          usando o aplicativo; ele voltará a aparecer no próximo login até o aceite.
        </p>
        <PrivacyPolicyContent headingId="privacy-policy-dialog-title" />
        <a
          className="privacy-policy-read-link"
          href={`${import.meta.env.BASE_URL}#/privacidade`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir página pública da minuta
        </a>
        {acceptError && <p className="form-error" role="alert">{acceptError}</p>}
        <div className="privacy-policy-actions">
          <button className="secondary-button" type="button" onClick={onDismiss}>Ler depois</button>
          <button className="primary-button" type="button" disabled={busy} onClick={onAccept}>
            {busy ? 'Registrando...' : `Li e aceito a versão ${policyVersion}`}
          </button>
        </div>
      </section>
    </div>
  )
}
