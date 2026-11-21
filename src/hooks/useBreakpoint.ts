import { useEffect, useState } from 'react'
import { BREAKPOINTS, type BreakpointLayout } from '../lib/breakpoints'

export function getBreakpointLayout(width: number): BreakpointLayout {
  if (width < BREAKPOINTS.tabletMin) return 'mobile'
  if (width < BREAKPOINTS.notebookMin) return 'tablet'
  return 'notebook'
}

export function useBreakpoint() {
  const [layout, setLayout] = useState<BreakpointLayout>(() =>
    getBreakpointLayout(window.innerWidth),
  )

  useEffect(() => {
    const updateLayout = () => setLayout(getBreakpointLayout(window.innerWidth))
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  return layout
}
