import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearOAuthCallbackParams, tryGetSupabaseClient } from '../../lib/supabase'
import { AuthContext, type AccountDeletionStatus, type AuthContextValue } from './auth-context'
import { recordTechnicalError } from '../../lib/diagnostics'
import { clearLocalStorage, clearUserDeviceData } from '../account/localDataCleanup'
import { isOfflineSyncing } from '../offline/sync'

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = tryGetSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [accountDeletionStatus, setAccountDeletionStatus] = useState<AccountDeletionStatus | null>(null)
  const [accountDeletionStatusError, setAccountDeletionStatusError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authErrorDetail, setAuthErrorDetail] = useState<string | null>(null)
  const initializedRef = useRef(false)
  const claimedSessionRef = useRef<string | null>(null)
  const handledSessionRef = useRef<string | null>(null)
  const refreshStatusRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    if (!supabase) return
    if (initializedRef.current) return
    initializedRef.current = true
    const clearPrivacyDismissals = () => {
      if (typeof window === 'undefined') return
      for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = window.sessionStorage.key(index)
        if (key?.startsWith('controle-app:privacy-dismissed:')) {
          window.sessionStorage.removeItem(key)
        }
      }
    }
    const claimInvitesOnce = async (userId: string) => {
      if (claimedSessionRef.current === userId) return
      claimedSessionRef.current = userId
      const { error } = await supabase.rpc('claim_invites')
      if (error) setClaimError('Entrou no aplicativo, mas não foi possível verificar convites pendentes.')
    }
    const readAccountDeletionStatus = async () => {
      if (!navigator.onLine) return []
      const { data, error } = await supabase.rpc('get_account_deletion_status')
      if (error) {
        setAccountDeletionStatusError('Não foi possível verificar o status da conta. Tente novamente.')
        throw error
      }
      setAccountDeletionStatusError(null)
      return data ?? []
    }
    const refreshAccountStatus = async (userId: string) => {
      const statuses = await readAccountDeletionStatus()
      const status = statuses[0] ?? null
      setAccountDeletionStatus(status)
      if (!status) await claimInvitesOnce(userId)
    }
    refreshStatusRef.current = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!data.user) {
          setAccountDeletionStatus(null)
          setAccountDeletionStatusError(null)
          return
        }
        await refreshAccountStatus(data.user.id)
      } catch (error) {
        if (navigator.onLine) {
          setAccountDeletionStatusError('Não foi possível verificar o status da conta. Tente novamente.')
        } else {
          setAccountDeletionStatusError(null)
        }
        recordTechnicalError('auth.accountDeletionStatus', error)
      } finally {
        setLoading(false)
      }
    }
    const syncSession = async (nextSession: Session | null) => {
      setSession(nextSession)
      if (!nextSession) {
        handledSessionRef.current = null
        claimedSessionRef.current = null
        setAccountDeletionStatus(null)
        setAccountDeletionStatusError(null)
        clearPrivacyDismissals()
        setLoading(false)
        return
      }

      const userId = nextSession.user.id
      if (handledSessionRef.current === userId) return
      handledSessionRef.current = userId
      setAccountDeletionStatus(null)
      setAccountDeletionStatusError(null)
      setLoading(true)
      try {
        await refreshAccountStatus(userId)
      } catch (error) {
        if (navigator.onLine) recordTechnicalError('auth.accountDeletionStatus', error)
      } finally {
        setLoading(false)
      }
    }
    const initializeSession = async () => {
      const callbackUrl = new URL(window.location.href)
      const code = callbackUrl.searchParams.get('code')
      let nextSession: Session | null = null

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setAuthError('Não foi possível concluir o login. Tente entrar novamente.')
          setAuthErrorDetail(`${error.message}${error.code ? ` [${error.code}]` : ''}`)
          recordTechnicalError('auth.exchangeCodeForSession', error)
        } else {
          nextSession = data.session
          if (data.session) {
            clearOAuthCallbackParams()
          }
        }
      } else {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          setAuthError('Não foi possível concluir o login. Tente entrar novamente.')
          setAuthErrorDetail(`${error.message}${error.code ? ` [${error.code}]` : ''}`)
          recordTechnicalError('auth.getSession', error)
        }
        nextSession = data.session
      }
      await syncSession(nextSession)
    }
    void initializeSession()
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        const url = new URL(window.location.href)
        if (['code','error','access_token','refresh_token'].some((key) => url.searchParams.has(key))) {
          clearOAuthCallbackParams()
        }
      }
      void syncSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [supabase])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    configured: Boolean(supabase),
    accountDeletionStatus,
    accountDeletionStatusError,
    refreshAccountDeletionStatus: async () => refreshStatusRef.current(),
    signInWithGoogle: async () => {
      if (!supabase) throw new Error('Supabase não configurado.')
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        },
      })
    },
    signInWithPassword: async (email, password) => {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signUpWithPassword: async (email, password) => {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      })
      if (error) throw error
    },
    resetPassword: async (email) => {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/redefinir-senha`,
      })
      if (error) throw error
    },
    updatePassword: async (password) => {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    signOut: async (discardPending = false) => {
      if (discardPending && isOfflineSyncing()) {
        throw new Error('Aguarde a sincronização em andamento antes de descartar a fila offline.')
      }
      const userId = session?.user.id ?? null
      await clearUserDeviceData(userId, { discardPending, preserveAuthStorage: true })
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) throw error
      }
      clearLocalStorage()
    },
    claimError,
    clearClaimError: () => setClaimError(null),
    authError,
    authErrorDetail,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

