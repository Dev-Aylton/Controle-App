import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import type { CompanyRole } from '../lib/database.types'
import { friendlySupabaseError, traduzirErro } from '../lib/errors'
import { canDeactivate, canInvite, canPromote, canViewCompanyCode } from '../lib/uiPermissions'
import { Container, Card, Avatar, ActionButton, ContextHelp } from '../components'
import { buildTeamMemberViews } from './teamRules'
import { getTeamMembers, type TeamMember } from '../services/team'

export function TeamPage() {
  const supabase = tryGetSupabaseClient()
  const { user } = useAuth()
  const { activeCompany, role, isAdmin, refresh } = useCompanies()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [code, setCode] = useState('')
  const [codeLoaded, setCodeLoaded] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingCode, setLoadingCode] = useState(false)
  const [membersError, setMembersError] = useState('')
  const [codeError, setCodeError] = useState('')
  const loadRequest = useRef(0)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'manager'>('manager')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !activeCompany) {
      setMembers([])
      setCode('')
      setCodeLoaded(false)
      setLoadingMembers(false)
      setLoadingCode(false)
      return
    }
    const requestId = ++loadRequest.current
    setLoadingMembers(true)
    setLoadingCode(canViewCompanyCode(role, isAdmin))
    setMembersError('')
    setCodeError('')
    setError('')
    try {
      const memberRows = await getTeamMembers(activeCompany.id)
      if (requestId !== loadRequest.current) return
      setMembers(memberRows)
    } catch (caught) {
      if (requestId !== loadRequest.current) return
      setMembers([])
      setMembersError(friendlySupabaseError(caught))
    } finally {
      if (requestId === loadRequest.current) setLoadingMembers(false)
    }

    if (!canViewCompanyCode(role, isAdmin)) {
      setCode('')
      setCodeLoaded(true)
      setLoadingCode(false)
      return
    }
    try {
      const codeResult = await supabase
        .from('company_codes')
        .select('*')
        .eq('company_id', activeCompany.id)
        .eq('active', true)
        .maybeSingle()
      if (requestId !== loadRequest.current) return
      if (codeResult.error) throw codeResult.error
      setCode(codeResult.data?.code ?? '')
      setCodeLoaded(true)
      setCodeError('')
    } catch (caught) {
      if (requestId !== loadRequest.current) return
      setCode('')
      setCodeLoaded(true)
      setCodeError(friendlySupabaseError(caught))
    } finally {
      if (requestId === loadRequest.current) setLoadingCode(false)
    }
  }, [activeCompany, isAdmin, role, supabase])

  useEffect(() => {
    queueMicrotask(() => { void load() })
    return () => { loadRequest.current += 1 }
  }, [load])

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !activeCompany) return
    setError('')
    setMessage('')
    try {
      const { error: inviteError } = await supabase.rpc('create_invite', {
        p_company_id: activeCompany.id,
        p_email: inviteEmail,
        p_role: inviteRole,
      })
      if (inviteError) throw inviteError
      setMessage('Convite criado.')
      setInviteEmail('')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível criar o convite. Confira o e-mail e tente novamente.'))
    }
  }

  const promote = async (membershipId: string) => {
    if (!supabase) return
    setError('')
    try {
      const { error: actionError } = await supabase.rpc('promote_to_manager', { p_membership_id: membershipId })
      if (actionError) throw actionError
      setMessage('Membro promovido a gerente.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível promover o membro. Tente novamente.'))
    }
  }

  const deactivate = async (membershipId: string) => {
    if (!supabase) return
    setError('')
    try {
      const { error: actionError } = await supabase.rpc('deactivate_member', { p_membership_id: membershipId })
      if (actionError) throw actionError
      setMessage('Membro desativado.')
      await refresh()
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível desativar o membro. Tente novamente.'))
    }
  }

  const rotateCode = async () => {
    if (!supabase || !activeCompany) return
    setError('')
    try {
      const { data, error: rotateError } = await supabase.rpc('rotate_company_code', { p_company_id: activeCompany.id })
      if (rotateError) throw rotateError
      setCode(data ?? '')
      setMessage('Código da empresa trocado.')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível trocar o código da empresa. Tente novamente.'))
    }
  }

  if (!activeCompany) {
    return <Container><h1>Equipe</h1><Card><p>Nenhuma empresa ativa selecionada.</p></Card></Container>
  }
  if (role === 'employee' && !isAdmin) {
    return <Container><h1>Equipe</h1><Card><p>Esta área está disponível para proprietários e gerentes.</p></Card></Container>
  }

  const teamMembers = buildTeamMemberViews({
    members,
    currentUserId: user?.id,
    currentUserName: user?.user_metadata.full_name ?? user?.email,
    currentUserEmail: user?.email,
    isAdmin,
  })
  const adminNotListed = isAdmin
    && Boolean(user?.id)
    && !members.some((member) => member.userId === user?.id)

  return (
    <Container>
      <h1>Equipe — {activeCompany.name}</h1>
      <ContextHelp
        title="Como funcionam os níveis da equipe?"
        description="Permissões definem quem pode visualizar, lançar ou administrar informações da empresa."
        steps={[
          'Funcionário: opera atividades autorizadas pelo seu vínculo.',
          'Gerente: gerencia estoque, preços, vendas, compras e contagens.',
          'Proprietário: administra a empresa e sua equipe.',
          'Administrador do app: atua como suporte e suas ações ficam identificadas.',
        ]}
        result="Convites e código só devem ser compartilhados com pessoas autorizadas."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <Card>
        {canViewCompanyCode(role, isAdmin) && (
          <div className="company-code">
            <span>Código atual</span>
            {loadingCode && <strong>Carregando...</strong>}
            {!loadingCode && codeError && (
              <>
                <strong role="alert">Não foi possível carregar o código.</strong>
                <ActionButton className="secondary-button" busyLabel="Tentando..." onAction={load}>Tentar de novo</ActionButton>
              </>
            )}
            {!loadingCode && !codeError && codeLoaded && <strong>{code || 'Nenhum código ativo'}</strong>}
            {isAdmin && <ActionButton className="secondary-button" busyLabel="Trocando..." confirmMessage="Trocar o código da empresa? O código atual deixará de funcionar." onAction={rotateCode}>Trocar código</ActionButton>}
          </div>
        )}
      </Card>
      {canInvite(role, isAdmin, 'manager') && (
        <Card>
          <h2>Convidar por e-mail</h2>
          <form onSubmit={(event) => event.preventDefault()} className="form-grid">
            <label>E-mail<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nome@empresa.com" required /></label>
            {isAdmin && (
              <label>Cargo
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'owner' | 'manager')}>
                  <option value="manager">Gerente</option>
                  <option value="owner">Proprietário</option>
                </select>
              </label>
            )}
            <ActionButton className="primary-button" busyLabel="Enviando..." onAction={() => invite({ preventDefault: () => undefined } as FormEvent)}>Convidar</ActionButton>
          </form>
        </Card>
      )}
      <Card>
        <h2>Membros ativos</h2>
        {adminNotListed && (
          <p>Você é o administrador do app e não consta como membro desta empresa.</p>
        )}
        <div className="member-list">
          {loadingMembers && <p className="page-state">Carregando membros...</p>}
          {!loadingMembers && membersError && (
            <div>
              <p className="form-error" role="alert">{membersError}</p>
              <ActionButton className="secondary-button" busyLabel="Tentando..." onAction={load}>Tentar de novo</ActionButton>
            </div>
          )}
          {!loadingMembers && !membersError && teamMembers.length === 0 && <p>Nenhum membro ativo encontrado.</p>}
          {!loadingMembers && !membersError && teamMembers.map((member) => {
            const targetRole = member.role as CompanyRole
            const deactivateAllowed = member.membershipId !== 'app-admin'
              && canDeactivate(role, isAdmin, targetRole, user?.id ?? '', member.userId)
            return (
              <article className="member-row" key={member.membershipId}>
                <div className="member-identity">
                  <Avatar
                    name={member.name}
                    googleUrl={undefined}
                    avatarKey={member.avatarKey ?? undefined}
                    storageBucket="profile-photos"
                    storagePath={member.avatarUrl && !/^https?:/.test(member.avatarUrl) ? member.avatarUrl : null}
                    size={44}
                  />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.email ?? 'E-mail não disponível'} • {targetRole} • {member.active ? 'Ativo' : 'Inativo'}</small>
                  </span>
                </div>
                <div className="member-actions">
                  {member.membershipId !== 'app-admin' && member.active && targetRole === 'employee' && canPromote(role, isAdmin) && (
                    <ActionButton className="secondary-button" busyLabel="Promovendo..." confirmMessage={`Promover ${member.name} a gerente? Essa alteração amplia as permissões de gestão.`} onAction={() => promote(member.membershipId)}>Promover</ActionButton>
                  )}
                  {deactivateAllowed && (
                    <ActionButton className="danger-button" busyLabel="Desativando..." confirmMessage="Desativar este membro?" onAction={() => deactivate(member.membershipId)}>Desativar</ActionButton>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </Card>
    </Container>
  )
}
