import { useMemo, useState } from 'react'
import { buildDiagnosticText } from '../lib/diagnostics'
import { formatAppVersion, getAppVersion } from '../lib/appVersion'
import { useCompanies } from '../features/company/company-context'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { Card } from './Card'
import { ActionButton } from './ActionButton'

type Props = { pendingCount: number; onClose: () => void }

export function DiagnosisModal({ pendingCount, onClose }: Props) {
  const { role, activeCompany, isAdmin } = useCompanies()
  const layout = useBreakpoint()
  const [copied, setCopied] = useState(false)
  const { version, build } = getAppVersion()
  const text = useMemo(() => buildDiagnosticText({
    version,
    build,
    online: navigator.onLine,
    layout,
    role: isAdmin ? 'admin/suporte' : role ?? 'sem vínculo',
    companyId: activeCompany?.id ?? '',
    pending: pendingCount,
    width: window.innerWidth,
    height: window.innerHeight,
    browser: navigator.userAgent,
  }), [activeCompany?.id, build, isAdmin, layout, pendingCount, role, version])

  return (
    <div className="photo-picker-modal" role="dialog" aria-modal="true" aria-labelledby="diagnosis-title">
      <Card>
        <div className="photo-picker-panel">
          <h2 id="diagnosis-title">Diagnóstico</h2>
          <pre className="diagnostic-text">{text}</pre>
          <div className="member-actions">
            <ActionButton className="secondary-button" busyLabel="Copiando..." onAction={async () => { await navigator.clipboard.writeText(text); setCopied(true) }}>{copied ? 'Copiado' : 'Copiar diagnóstico'}</ActionButton>
            <button className="primary-button" type="button" onClick={onClose}>Fechar</button>
          </div>
          <small>{formatAppVersion()}</small>
        </div>
      </Card>
    </div>
  )
}
