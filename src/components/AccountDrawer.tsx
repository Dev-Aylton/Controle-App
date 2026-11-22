import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { useCompanies } from '../features/company/company-context'
import { Avatar } from './Avatar'
import { ActionButton } from './ActionButton'
import { DiagnosisModal } from './DiagnosisModal'
import { applyTheme, getSavedTheme, type ThemeMode } from '../lib/theme'
import { formatAppVersion, getAppVersion } from '../lib/appVersion'
import { buildDiagnosticText, buildSanitizedMailDiagnostic, createSevenClickCounter } from '../lib/diagnostics'
import { buildReportBody, checkPublishedVersion, isNewerVersion, type PublishedVersion } from '../lib/versionCheck'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { exportCompanyData, exportPersonalData } from '../features/account/accountExport'
import { traduzirErro } from '../lib/errors'
import { useConfirm } from './confirmContext'
import { isOfflineSyncing } from '../features/offline/sync'
import { canManageCompany } from '../lib/uiPermissions'
import { TutorialModal } from '../features/tutorial/TutorialModal'
import { deleteCurrentAccount } from '../features/account/deleteAccount'
import { useSafeSignOut } from '../features/account/useSafeSignOut'
import { getOfflineQueueStatus } from '../features/offline/sync'

type Props = { open: boolean; online: boolean; pendingCount: number; onClose: () => void }

export function AccountDrawer({ open, online, pendingCount, onClose }: Props) {
  const { user } = useAuth()
  const { activeCompany, role, isAdmin } = useCompanies()
  const layout = useBreakpoint()
  const confirm = useConfirm()
  const safeSignOut = useSafeSignOut()
  const panelRef = useRef<HTMLElement>(null)
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme)
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [update, setUpdate] = useState<PublishedVersion | null>(null)
  const [updateStatus, setUpdateStatus] = useState('')
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const version = useState(getAppVersion)[0]
  const sevenClicks = useState(() => createSevenClickCounter(() => setDiagnosisOpen(true)))[0]

  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a,input,select')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose, open])

  const checkUpdate = async () => {
    if (!navigator.onLine) {
      setUpdateStatus('Sem conexão. Tente novamente quando estiver online.')
      return
    }
    try {
      const published = await checkPublishedVersion()
      if (isNewerVersion(version, published)) {
        setUpdate(published)
        setUpdateStatus(`Nova versão disponível: v${published.version}`)
      } else setUpdateStatus('Seu app está atualizado.')
    } catch (error) {
      setUpdateStatus(traduzirErro(error, 'Não foi possível verificar atualização.'))
    }
  }

  const applyUpdate = async () => {
    if (isOfflineSyncing() || pendingCount > 0 && !navigator.onLine) {
      setUpdateStatus('Aguarde a sincronização e uma conexão estável antes de atualizar.')
      return
    }
    if (document.visibilityState === 'hidden') return
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true, onNeedRefresh() {} })()
    window.location.reload()
  }

  const copyReport = async () => {
    const diagnostics = buildDiagnosticText({
      version: version.version, build: version.build, online: navigator.onLine, layout,
      role: isAdmin ? 'admin/suporte' : role ?? 'sem vínculo',
      companyId: activeCompany?.id ?? '', pending: pendingCount,
      width: window.innerWidth, height: window.innerHeight, browser: navigator.userAgent,
    })
    await navigator.clipboard.writeText(diagnostics)
  }

  const deleteAccount = async () => {
    setDeletePending(true)
    setDeleteError('')
    try {
      if (isOfflineSyncing()) throw new Error('Aguarde a sincronização dos lançamentos antes de solicitar a exclusão.')
      if (!user?.id) throw new Error('Usuário não autenticado.')
      const queueStatus = await getOfflineQueueStatus(user.id)
      const ok = await confirm({
        title: 'Solicitar exclusão da conta',
        message: `O acesso será encerrado e seus vínculos desativados. Você poderá cancelar o pedido entrando novamente em até 90 dias; depois desse prazo, os identificadores da conta serão removidos e o histórico operacional será preservado.${queueStatus.userPending > 0 ? ` ${queueStatus.userPending} lançamento(s) pendente(s) desta conta serão descartados do aparelho.` : ''}${queueStatus.hasUnassignedPending ? ' Registros offline antigos sem conta vinculada também serão descartados do aparelho.' : ''}`,
        confirmLabel: 'Solicitar exclusão',
        requireText: 'EXCLUIR',
      })
      if (!ok) return
      if (isOfflineSyncing()) throw new Error('Aguarde a sincronização dos lançamentos antes de solicitar a exclusão.')
      await deleteCurrentAccount(user.id)
    } catch (error) {
      setDeleteError(traduzirErro(error, 'Não foi possível excluir a conta.'))
    } finally {
      setDeletePending(false)
    }
  }

  if (!open) return safeSignOut.dialog
  const diagnosticSummary = buildSanitizedMailDiagnostic({
    version: version.version, build: version.build, online: navigator.onLine, layout,
    role: isAdmin ? 'admin/suporte' : role ?? 'sem vínculo',
    companyId: activeCompany?.id ?? '', pending: pendingCount,
    width: window.innerWidth, height: window.innerHeight, browser: navigator.userAgent,
  })
  const reportBody = buildReportBody(version.version, version.build, diagnosticSummary)

  return (
    <div className="account-drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="account-drawer" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Minha conta">
        <header className="account-drawer-header">
          <h2>Minha conta</h2>
          <button className="secondary-button" type="button" onClick={onClose} aria-label="Fechar painel da conta">Fechar</button>
        </header>
        <section className="account-drawer-section">
          <div className="member-identity">
            <Avatar name={user?.user_metadata.full_name ?? user?.email} googleUrl={user?.user_metadata.avatar_url} size={64} />
            <span><strong>{user?.user_metadata.full_name ?? 'Usuário'}</strong><small>{isAdmin ? 'Admin/suporte' : role ?? 'Sem vínculo'}</small></span>
          </div>
          <p className="account-section-description">Sua identidade e o status de conexão nesta sessão.</p>
        <div className="account-status" role="status">
          <span className={online ? 'status-online' : 'status-offline'} aria-hidden="true"></span>
          <strong>{online ? 'Online' : 'Offline'}</strong>
          {pendingCount > 0 && <small>{pendingCount} item(ns) pendente(s)</small>}
        </div>
        <NavLink to="/perfil" onClick={onClose}>Editar meu perfil</NavLink>
        </section>
        <section className="account-drawer-section">
          <h3 className="account-drawer-section-title">Preferências</h3>
          <p className="account-section-description">Escolha como o aplicativo será exibido e mantenha o sistema atualizado.</p>
          <label>Tema
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}>
              <option value="light">Claro</option><option value="dark">Escuro</option>
            </select>
          </label>
          <button
            className="version-button"
            type="button"
            onClick={sevenClicks}
            aria-label={`Versão do aplicativo ${formatAppVersion()}`}
            title="Versão do aplicativo"
          >
            {formatAppVersion()}
          </button>
          <ActionButton className="secondary-button" busyLabel="Verificando..." onAction={checkUpdate}>Verificar atualização</ActionButton>
          {updateStatus && <p role="status">{updateStatus}</p>}
          {update && <ActionButton className="primary-button" onAction={applyUpdate}>Atualizar agora</ActionButton>}
        </section>
        <section className="account-drawer-section">
          <h3 className="account-drawer-section-title">Ações e ajuda</h3>
          <p className="account-section-description">Conheça os recursos do seu cargo, envie informações técnicas ou exporte seus dados.</p>
          <button className="secondary-button" type="button" onClick={() => setTutorialOpen(true)}>Ver tutorial do meu cargo</button>
          <NavLink to="/privacidade" onClick={onClose}>Aviso de Privacidade (minuta)</NavLink>
          <a href={`mailto:desenvolvedor.aylton@gmail.com?subject=${encodeURIComponent('Problema no Controle-App')}&body=${encodeURIComponent(reportBody)}`}>Reportar problema</a>
          <ActionButton className="secondary-button" busyLabel="Copiando..." onAction={copyReport}>Copiar diagnóstico completo</ActionButton>
          {user?.id && <ActionButton className="secondary-button" busyLabel="Preparando..." onAction={() => exportPersonalData(user.id)}>Baixar meus dados pessoais</ActionButton>}
          {activeCompany && canManageCompany(role, isAdmin) && <ActionButton className="secondary-button" busyLabel="Exportando..." onAction={() => exportCompanyData(activeCompany.id, activeCompany.name, role, isAdmin)}>Exportar dados da empresa</ActionButton>}
        </section>
        <button className="logout-button" type="button" disabled={safeSignOut.busy} onClick={() => void safeSignOut.requestSignOut()}>
          {safeSignOut.busy ? 'Saindo...' : 'Sair'}
        </button>
        {safeSignOut.error && <p className="form-error" role="alert">{safeSignOut.error}</p>}
        <section className="danger-zone" aria-labelledby="danger-zone-title">
          <div className="danger-zone-heading">
            <span className="danger-zone-mark" aria-hidden="true">!</span>
            <div>
              <h3 id="danger-zone-title">Zona de perigo</h3>
              <p>Ações permanentes relacionadas à sua conta.</p>
            </div>
          </div>
          <details className="danger-zone-details">
            <summary>Gerenciar exclusão da conta</summary>
            <div className="danger-zone-content">
              <p>O pedido encerra sua sessão e inicia um prazo de 90 dias para reativação. Ao fim do prazo, os identificadores serão removidos; o histórico operacional será mantido. Transfira a propriedade das empresas antes de continuar.</p>
              <ActionButton className="danger-button" disabled={deletePending} busyLabel="Solicitando..." onAction={deleteAccount}>Solicitar exclusão da conta</ActionButton>
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
            </div>
          </details>
        </section>
      </aside>
      {diagnosisOpen && <DiagnosisModal pendingCount={pendingCount} onClose={() => setDiagnosisOpen(false)} />}
      {tutorialOpen && <TutorialModal role={role} isAdmin={isAdmin} onClose={() => setTutorialOpen(false)} />}
      {safeSignOut.dialog}
    </div>
  )
}
