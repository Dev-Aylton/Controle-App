import { useCallback, useEffect, useState } from 'react'
import { recordTechnicalError } from '../../lib/diagnostics'
import { tryGetSupabaseClient } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog'

export function PrivacyPolicyPrompt() {
  const { user, loading } = useAuth()
  const [policyStatus, setPolicyStatus] = useState<{ userId: string; version: string; publishedAt: string; needsAcceptance: boolean } | null>(null)
  const [dismissedKey, setDismissedKey] = useState('')
  const [queryError, setQueryError] = useState<{ userId: string; message: string } | null>(null)
  const [acceptError, setAcceptError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!user?.id || loading) return

    let active = true
    const loadPolicyStatus = async () => {
      await Promise.resolve()
      const supabase = tryGetSupabaseClient()
      if (!supabase) {
        if (active) setQueryError({ userId: user.id, message: 'Não foi possível verificar a política de privacidade.' })
        return
      }

      const { data, error } = await supabase.rpc('get_privacy_policy_status')
      if (!active) return
      if (error) {
        setQueryError({ userId: user.id, message: 'Não foi possível verificar a política de privacidade. Tente novamente.' })
        recordTechnicalError('privacy.getPolicyStatus', error)
        return
      }

      const currentRelease = data?.[0]
      setQueryError(null)
      setPolicyStatus({
        userId: user.id,
        version: currentRelease?.policy_version ?? '',
        publishedAt: currentRelease?.published_at ?? '',
        needsAcceptance: Boolean(currentRelease && !currentRelease.accepted_at),
      })
    }

    void loadPolicyStatus()
    return () => { active = false }
  }, [loading, retryCount, user?.id])

  const currentStatus = policyStatus?.userId === user?.id ? policyStatus : null
  const policyVersion = currentStatus?.version ?? ''
  const needsAcceptance = currentStatus?.needsAcceptance ?? false
  const currentQueryError = queryError && queryError.userId === user?.id ? queryError.message : ''
  const dismissalKey = user?.id && policyVersion
    ? `controle-app:privacy-dismissed:${user.id}:${policyVersion}`
    : ''
  const storedDismissal = dismissalKey && typeof window !== 'undefined'
    ? window.sessionStorage.getItem(dismissalKey) === '1'
    : false
  const open = !loading && !currentQueryError && needsAcceptance && Boolean(dismissalKey)
    && dismissedKey !== dismissalKey && !storedDismissal

  const dismiss = useCallback(() => {
    if (dismissalKey) {
      window.sessionStorage.setItem(dismissalKey, '1')
      setDismissedKey(dismissalKey)
    }
  }, [dismissalKey])

  const acceptPolicy = async () => {
    setBusy(true)
    setAcceptError('')
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.rpc('accept_current_privacy_policy')
      if (error) throw error
      setPolicyStatus((current) => current && current.userId === user?.id
        ? { ...current, needsAcceptance: false }
        : current)
    } catch (error) {
      setAcceptError('Não foi possível registrar o aceite. Tente novamente.')
      recordTechnicalError('privacy.acceptPolicy', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {currentQueryError && (
        <div className="privacy-policy-status app-error-banner" role="alert">
          <span>{currentQueryError}</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Tentar novamente</button>
        </div>
      )}
      <PrivacyPolicyDialog
        open={open}
        policyVersion={policyVersion}
        policyPublishedAt={currentStatus?.publishedAt}
        busy={busy}
        acceptError={acceptError}
        onDismiss={dismiss}
        onAccept={() => void acceptPolicy()}
      />
    </>
  )
}
