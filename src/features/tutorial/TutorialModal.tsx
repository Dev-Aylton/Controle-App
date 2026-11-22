import { useEffect, useRef, useState } from 'react'
import type { CompanyRole } from '../../lib/database.types'
import { getTutorialSteps } from './tutorial'

type Props = { role: CompanyRole | null; isAdmin: boolean; onClose: () => void }

export function TutorialModal({ role, isAdmin, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const steps = getTutorialSteps(role, isAdmin)
  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const current = steps[index]
  return (
    <div className="confirm-backdrop" role="presentation">
      <div className="confirm-dialog" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <small>Passo {index + 1} de {steps.length}</small>
        <h2 id="tutorial-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="member-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Fechar</button>
          {index > 0 && <button className="secondary-button" type="button" onClick={() => setIndex(index - 1)}>Anterior</button>}
          {index < steps.length - 1
            ? <button className="primary-button" type="button" onClick={() => setIndex(index + 1)}>Próximo</button>
            : <button className="primary-button" type="button" onClick={onClose}>Concluir</button>}
        </div>
      </div>
    </div>
  )
}
