import type { ReactNode } from 'react'

export function Card({ children }: { children: ReactNode }) {
  return <section className="responsive-card">{children}</section>
}
