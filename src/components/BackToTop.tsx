import { useEffect, useRef, useState } from 'react'
import { shouldShowBackToTop } from './backToTopRules'

export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const update = () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      if (!shouldShowBackToTop(window.scrollY)) {
        setVisible(false)
        return
      }
      setVisible(true)
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 1800)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      className="back-to-top back-to-top-visible"
      aria-label="Voltar ao topo"
      onClick={() => {
        setVisible(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
    >
      ↑
    </button>
  )
}
