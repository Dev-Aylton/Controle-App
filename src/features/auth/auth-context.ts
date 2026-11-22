import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AccountDeletionStatus = {
  request_id: string
  status: 'pending' | 'finalizing'
  requested_at: string
  scheduled_for: string
  can_reactivate: boolean
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  accountDeletionStatus: AccountDeletionStatus | null
  accountDeletionStatusError: string | null
  refreshAccountDeletionStatus: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: (discardPending?: boolean) => Promise<void>
  claimError: string | null
  clearClaimError: () => void
  authError: string | null
  authErrorDetail: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
