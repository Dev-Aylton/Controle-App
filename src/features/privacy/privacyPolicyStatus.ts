import { useEffect, useState } from 'react'
import { tryGetSupabaseClient } from '../../lib/supabase'

export type PrivacyPolicyRelease = {
  version: string
  publishedAt: string
}

export function formatPrivacyPolicyDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function getPrivacyPolicyLinkLabel() {
  return 'Aviso de Privacidade'
}

export function usePrivacyPolicyRelease(userId: string | null) {
  const [status, setStatus] = useState<{ userId: string; release: PrivacyPolicyRelease | null } | null>(null)

  useEffect(() => {
    if (!userId) return
    let active = true
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    void supabase.rpc('get_privacy_policy_status').then(({ data, error }) => {
      if (!active || error) {
        if (active) setStatus({ userId, release: null })
        return
      }
      const row = data?.[0] as { policy_version?: string; published_at?: string } | undefined
      if (!row?.policy_version || !row.published_at) {
        setStatus({ userId, release: null })
        return
      }
      setStatus({
        userId,
        release: { version: row.policy_version, publishedAt: row.published_at },
      })
    })
    return () => { active = false }
  }, [userId])

  return status?.userId === userId ? status.release : null
}
