import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import type { CompanyRole } from '../../lib/database.types'
import { getTutorialSteps } from './tutorial'

type Props = {
  role: CompanyRole | null
  isAdmin: boolean
  onClose: () => void
  onNavigate?: () => void
}

export function TutorialModal({ role, isAdmin, onClose, onNavigate }: Props) {
  const [index, setIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const topicListRef = useRef<HTMLElement>(null)
  const topicRefs = useRef<Array<HTMLButtonElement | null>>([])
  const stepCopyRef = useRef<HTMLDivElement>(null)
  const steps = getTutorialSteps(role, isAdmin)
  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, steps.length - 1))
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, steps.length])
  useEffect(() => {
    const list = topicListRef.current
    const topic = topicRefs.current[index]
    if (!list || !topic) return
    const targetLeft = topic.offsetLeft - (list.clientWidth - topic.offsetWidth) / 2
    list.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    })
  }, [index])
  useEffect(() => {
    if (stepCopyRef.current) stepCopyRef.current.scrollTop = 0
  }, [index])
  const current = steps[index]
  return (
    <div className="tutorial-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div className="tutorial-modal" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <aside className="tutorial-sidebar" aria-label="Tópicos do tutorial">
          <div className="tutorial-heading">
            <div>
              <span>Guia rápido</span>
              <strong>Como usar o Controle-App</strong>
            </div>
            <button className="tutorial-close-icon" type="button" onClick={onClose} aria-label="Fechar tutorial">×</button>
          </div>
          <nav className="tutorial-topic-list" ref={topicListRef}>
            {steps.map((step, topicIndex) => (
              <button
                key={step.title}
                ref={(element) => { topicRefs.current[topicIndex] = element }}
                type="button"
                className={topicIndex === index ? 'active' : ''}
                aria-current={topicIndex === index ? 'step' : undefined}
                onClick={() => setIndex(topicIndex)}
              >
                <span>{String(topicIndex + 1).padStart(2, '0')}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </nav>
        </aside>
        <section className="tutorial-content">
          <div className="tutorial-progress" aria-label={`Tópico ${index + 1} de ${steps.length}`}>
            {steps.map((step, topicIndex) => (
              <span key={step.title} className={topicIndex <= index ? 'active' : ''} />
            ))}
          </div>
          <div className="tutorial-step-copy" ref={stepCopyRef}>
            <small>Tópico {index + 1} de {steps.length}</small>
            <h2 id="tutorial-title">{current.title}</h2>
            <p>{current.body}</p>
            {current.bullets.length > 0 && (
              <ul>
                {current.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            )}
            {current.route && current.routeLabel && (
              <NavLink
                className="tutorial-route-link"
                to={current.route}
                onClick={() => {
                  onNavigate?.()
                  onClose()
                }}
              >
                {current.routeLabel}
              </NavLink>
            )}
          </div>
          <footer className="tutorial-actions">
            <button className="tutorial-secondary" type="button" onClick={onClose}>Fechar</button>
            <div>
              {index > 0 && <button className="tutorial-secondary" type="button" onClick={() => setIndex(index - 1)}>Anterior</button>}
              {index < steps.length - 1
                ? <button className="tutorial-primary" type="button" onClick={() => setIndex(index + 1)}>Próximo</button>
                : <button className="tutorial-primary" type="button" onClick={onClose}>Concluir</button>}
            </div>
          </footer>
        </section>
        </div>
    </div>
  )
}
