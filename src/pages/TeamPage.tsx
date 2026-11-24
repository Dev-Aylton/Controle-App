import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import type { CompanyRole } from '../lib/database.types'
import { friendlySupabaseError, traduzirErro } from '../lib/errors'
import { canDeactivate, canInvite, canPromote, canReactivate, canViewCompanyCode } from '../lib/uiPermissions'
import { Container, Card, Avatar, ActionButton, ContextHelp, PageGuide } from '../components'
import { buildTeamMemberViews, filterTeamMemberViews, getTeamRoleLabel, type TeamMemberFilter } from './teamRules'
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
  const [teamSearch, setTeamSearch] = useState('')
  const [teamRoleFilter, setTeamRoleFilter] = useState<TeamMemberFilter['role']>('todos')
  const [teamStatusFilter, setTeamStatusFilter] = useState<TeamMemberFilter['status']>('todos')
  const [deactivationReason, setDeactivationReason] = useState('')

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
      const codeResult = await supabase.rpc('get_company_code', { p_company_id: activeCompany.id })
      if (requestId !== loadRequest.current) return
      if (codeResult.error) throw codeResult.error
      setCode(typeof codeResult.data === 'string' ? codeResult.data : '')
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
      const { error: actionError } = await supabase.rpc('deactivate_member', {
        p_membership_id: membershipId,
        p_reason: deactivationReason.trim() || null,
      })
      if (actionError) throw actionError
      setDeactivationReason('')
      setMessage('Membro desativado.')
      await refresh()
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível desativar o membro. Tente novamente.'))
    }
  }

  const reactivate = async (membershipId: string) => {
    if (!supabase) return
    setError('')
    try {
      const { error: actionError } = await supabase.rpc('reactivate_member', {
        p_membership_id: membershipId,
      })
      if (actionError) throw actionError
      setMessage('Membro reativado.')
      await refresh()
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível reativar o membro.'))
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

  const ensureCode = async () => {
    if (!supabase || !activeCompany) return
    setError('')
    try {
      const { data, error: ensureError } = await supabase.rpc('ensure_company_code', { p_company_id: activeCompany.id })
      if (ensureError) throw ensureError
      setCode(typeof data === 'string' ? data : '')
      setCodeLoaded(true)
      setMessage('Código inicial da empresa criado.')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível gerar o código inicial da empresa.'))
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
  const filteredTeamMembers = filterTeamMemberViews(teamMembers, {
    search: teamSearch,
    role: teamRoleFilter,
    status: teamStatusFilter,
  })
  const adminNotListed = isAdmin
    && Boolean(user?.id)
    && !members.some((member) => member.userId === user?.id)

  return (
    <Container>
      <h1>Equipe — {activeCompany.name}</h1>
      <PageGuide
        purpose="Controlar membros, cargos e entrada de pessoas na empresa."
        doNext="Confira os membros ativos e use convidar ou código apenas para pessoas autorizadas."
        result="Cada usuário recebe somente as ações compatíveis com seu cargo."
        roleNote={isAdmin ? 'Como administrador, você pode operar como suporte e revisar toda a equipe.' : role === 'owner' ? 'Como proprietário, você pode gerir equipe e promover gerentes.' : 'Como gerente, você pode operar membros da equipe conforme suas permissões.'}
      />
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
            {!loadingCode && !codeError && codeLoaded && (
              code
                ? <strong>{code}</strong>
                : <ActionButton className="primary-button" busyLabel="Gerando..." confirmMessage="Gerar o primeiro código da empresa? Nenhum funcionário será desvinculado." onAction={ensureCode}>Gerar código inicial</ActionButton>
            )}
            {isAdmin && <ActionButton className="danger-button" busyLabel="Trocando..." confirmMessage={`Trocar o código da empresa "${activeCompany.name}"? A ação invalidará o código atual e pode afetar o acesso de novos funcionários. Use somente após comunicar à equipe.`} requireText={activeCompany.name} onAction={rotateCode}>Trocar código</ActionButton>}
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
        <h2>Membros da equipe</h2>
        {adminNotListed && (
          <p>Você é o administrador do app e não consta como membro desta empresa.</p>
        )}
        <div className="form-grid">
          <label>Buscar pessoa
            <input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Nome ou e-mail" />
          </label>
          <label>Cargo
            <select value={teamRoleFilter} onChange={(event) => setTeamRoleFilter(event.target.value as TeamMemberFilter['role'])}>
              <option value="todos">Todos</option>
              <option value="owner">Proprietários</option>
              <option value="manager">Gerentes</option>
              <option value="employee">Funcionários</option>
            </select>
          </label>
          <label>Status
            <select value={teamStatusFilter} onChange={(event) => setTeamStatusFilter(event.target.value as TeamMemberFilter['status'])}>
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </label>
        </div>
        <div className="member-list">
          {loadingMembers && <p className="page-state">Carregando membros...</p>}
          {!loadingMembers && membersError && (
            <div>
              <p className="form-error" role="alert">{membersError}</p>
              <ActionButton className="secondary-button" busyLabel="Tentando..." onAction={load}>Tentar de novo</ActionButton>
            </div>
          )}
          {!loadingMembers && !membersError && filteredTeamMembers.length === 0 && <p>Nenhum membro corresponde aos filtros.</p>}
          {!loadingMembers && !membersError && filteredTeamMembers.map((member) => {
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
                    <small>{member.email ?? 'E-mail não disponível'} • {getTeamRoleLabel(targetRole)} • {member.active ? 'Ativo' : 'Inativo'}</small>
                    {!member.active && member.deactivatedReason && (
                      <small>Motivo do desligamento: {member.deactivatedReason}</small>
                    )}
                    {!member.active && member.deactivatedAt && (
                      <small>Desativado em {new Date(member.deactivatedAt).toLocaleString('pt-BR')}</small>
                    )}
                  </span>
                </div>
                <div className="member-actions">
                  {member.membershipId !== 'app-admin' && member.active && targetRole === 'employee' && canPromote(role, isAdmin) && (
                    <ActionButton className="secondary-button" busyLabel="Promovendo..." confirmMessage={`Promover ${member.name} a gerente? Essa alteração amplia as permissões de gestão.`} onAction={() => promote(member.membershipId)}>Promover</ActionButton>
                  )}
                  {deactivateAllowed && (
                    <>
                      <label>Motivo do desligamento
                        <input value={deactivationReason} onChange={(event) => setDeactivationReason(event.target.value)} placeholder="Ex.: troca de responsável" />
                      </label>
                      <ActionButton
                        className="danger-button"
                        busyLabel="Desativando..."
                        confirmMessage={`Desativar ${member.name}? O histórico será preservado e o vínculo poderá ser reativado.`}
                        onAction={() => deactivate(member.membershipId)}
                      >
                        Desativar
                      </ActionButton>
                    </>
                  )}
                  {!member.active && member.membershipId !== 'app-admin' && canReactivate(role, isAdmin, targetRole) && (
                    <ActionButton
                      className="secondary-button"
                      busyLabel="Reativando..."
                      confirmMessage={`Reativar ${member.name}? O usuário voltará a ter acesso conforme seu vínculo e cargo.`}
                      onAction={() => reactivate(member.membershipId)}
                    >
                      Reativar
                    </ActionButton>
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
