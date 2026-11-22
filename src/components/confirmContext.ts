import { createContext, useContext } from 'react'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  requireText?: string
}

export type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<ConfirmContextValue>(() => Promise.resolve(false))

export function useConfirm() {
  return useContext(ConfirmContext)
}
