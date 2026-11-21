import type { ReactNode } from 'react'

export function Grid({ children }: { children: ReactNode }) {
  return <div className="responsive-grid">{children}</div>
}
