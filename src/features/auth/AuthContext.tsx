import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearOAuthCallbackParams, tryGetSupabaseClient } from '../../lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = tryGetSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [claimError, setClaimError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authErrorDetail, setAuthErrorDetail] = useState<string | null>(null)
  const initializedRef = useRef(false)
  const claimedSessionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    if (initializedRef.current) return
    initializedRef.current = true
    const claimInvitesOnce = async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId || claimedSessionRef.current === userId) return
      claimedSessionRef.current = userId
      const { error } = await supabase.rpc('claim_invites')
      if (error) setClaimError('Entrou no aplicativo, mas não foi possível verificar convites pendentes.')
    }
    const initializeSession = async () => {
      const callbackUrl = new URL(window.location.href)
      const code = callbackUrl.searchParams.get('code')

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setAuthError('Não foi possível concluir o login. Tente entrar novamente.')
          setAuthErrorDetail(`${error.message}${error.code ? ` [${error.code}]` : ''}`)
          setSession(null)
        } else {
          setSession(data.session)
          if (data.session) {
            clearOAuthCallbackParams()
            await claimInvitesOnce()
          }
        }
      } else {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          setAuthError('Não foi possível concluir o login. Tente entrar novamente.')
          setAuthErrorDetail(`${error.message}${error.code ? ` [${error.code}]` : ''}`)
        }
        setSession(data.session)
        if (data.session) await claimInvitesOnce()
      }
      setLoading(false)
    }
    void initializeSession()
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (nextSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        const url = new URL(window.location.href)
        if (['code','error','access_token','refresh_token'].some((key) => url.searchParams.has(key))) {
          clearOAuthCallbackParams()
        }
        void claimInvitesOnce()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [supabase])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    configured: Boolean(supabase),
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
        redirectTo: `${window.location.origin}/Controle-App/#/redefinir-senha`,
      })
      if (error) throw error
    },
    signOut: async () => {
      if (!supabase) return
      await supabase.auth.signOut({ scope: 'local' })
    },
    claimError,
    clearClaimError: () => setClaimError(null),
    authError,
    authErrorDetail,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

