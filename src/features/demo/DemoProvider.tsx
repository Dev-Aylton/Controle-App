import { useState, type ReactNode } from 'react'
import { DemoContext } from './DemoContext'
import { createDemoState, type DemoRole } from './demoData'

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createDemoState)

  const setRole = (role: DemoRole) => setState((current) => ({ ...current, role }))
  const reset = () => setState(createDemoState())
  const deactivateEmployee = () => setState((current) => ({ ...current, employeeActive: false, role: current.role === 'employee' ? 'employee' : current.role }))
  const rotateCode = () => setState((current) => ({ ...current, codeVersion: current.codeVersion + 1 }))

  return (
    <DemoContext.Provider value={{ state, setRole, reset, deactivateEmployee, rotateCode }}>
      {children}
    </DemoContext.Provider>
  )
}
