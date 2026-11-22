import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { applyTheme, getSavedTheme } from '../../lib/theme'
import { PrivacyPolicyContent } from './PrivacyPolicyContent'

export function PrivacyPolicyPage() {
  useEffect(() => {
    applyTheme(getSavedTheme())
  }, [])

  return (
    <main className="auth-page privacy-policy-shell">
      <article className="privacy-policy-page">
        <PrivacyPolicyContent headingId="privacy-policy-page-title" />
        <Link className="secondary-button privacy-policy-back" to="/login">Voltar</Link>
      </article>
    </main>
  )
}
