import { createContext, useContext } from 'react'
import type { DemoRole, DemoState } from './demoData'

export type DemoContextValue = {
  state: DemoState
  setRole: (role: DemoRole) => void
  reset: () => void
  deactivateEmployee: () => void
  rotateCode: () => void
}

export const DemoContext = createContext<DemoContextValue | null>(null)

export function useDemo() {
  const value = useContext(DemoContext)
  if (!value) throw new Error('useDemo deve ser usado dentro de DemoProvider')
  return value
}
