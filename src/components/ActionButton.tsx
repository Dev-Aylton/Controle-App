import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createActionGuard } from './actionGuard'
import { useConfirm } from './confirmContext'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  children: ReactNode
  busyLabel?: string
  successLabel?: string
  errorLabel?: string
  disabledReason?: string
  onAction: () => void | Promise<void>
  confirmMessage?: string
  requireText?: string
}

export function ActionButton({
  children, busyLabel = 'Executando...', successLabel = 'Concluído', errorLabel = 'Tentar novamente',
  onAction, confirmMessage, requireText, disabled, disabledReason, type = 'button', ...props
}: Props) {
  const [state, setState] = useState<'idle'|'running'|'success'|'error'>('idle')
  const guard = useRef(createActionGuard())
  const confirm = useConfirm()
  const run = async () => {
    if (state === 'running') return
    if (disabled) {
      setState('error')
      window.setTimeout(() => setState('idle'), 2200)
      return
    }
    if (confirmMessage && !await confirm({
      title: 'Confirmar ação',
      message: confirmMessage,
      confirmLabel: 'Confirmar',
      requireText,
    })) return
    setState('running')
    try {
      const executed = await guard.current.run(onAction)
      if (!executed) return
      setState('success')
      window.setTimeout(() => setState('idle'), 1200)
    } catch {
      setState('error')
    }
  }
  const label = state === 'running'
    ? busyLabel
    : state === 'success'
      ? successLabel
      : state === 'error'
        ? disabled ? (disabledReason ?? 'Preencha os campos obrigatórios') : errorLabel
        : children
  return (
    <button
      {...props}
      type={type}
      onClick={() => void run()}
      disabled={state === 'running'}
      aria-disabled={disabled || state === 'running'}
      aria-busy={state === 'running'}
      title={disabled ? (disabledReason ?? 'Preencha os campos obrigatórios para continuar.') : props.title}
      data-state={disabled ? 'unavailable' : state}
    >
      {label}
    </button>
  )
}
