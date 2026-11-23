import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { applyTheme, getSavedTheme } from '../../lib/theme'
import { PrivacyPolicyContent } from './PrivacyPolicyContent'
import { useAuth } from '../auth/auth-context'
import { usePrivacyPolicyRelease } from './privacyPolicyStatus'

export function PrivacyPolicyPage() {
  const { user } = useAuth()
  const release = usePrivacyPolicyRelease(user?.id ?? null)

  useEffect(() => {
    applyTheme(getSavedTheme())
  }, [])

  return (
    <main className="auth-page privacy-policy-shell">
      <article className="privacy-policy-page">
        <PrivacyPolicyContent headingId="privacy-policy-page-title" release={release} />
        <Link className="secondary-button privacy-policy-back" to="/login">Voltar</Link>
      </article>
    </main>
  )
}
