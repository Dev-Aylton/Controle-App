import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import type { Tables, CompanyRole } from '../lib/database.types'
import { friendlySupabaseError } from '../lib/errors'
import { canDeactivate, canInvite, canPromote, canViewCompanyCode } from '../lib/uiPermissions'
import { Container, Card, Avatar } from '../components'

type Membership = Tables<'memberships'>

export function TeamPage() {
  const supabase = tryGetSupabaseClient()
  const { user } = useAuth()
  const { activeCompany, role, isAdmin, refresh } = useCompanies()
  const [members, setMembers] = useState<Membership[]>([])
  const [profiles, setProfiles] = useState<Record<string, Tables<'profiles'>>>({})
  const [code, setCode] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner' | 'manager'>('manager')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !activeCompany) return
    setError('')
    const [{ data: memberRows }, { data: codeRows }] = await Promise.all([
      supabase.from('memberships').select('*').eq('company_id', activeCompany.id).eq('active', true),
      canViewCompanyCode(role, isAdmin)
        ? supabase.from('company_codes').select('*').eq('company_id', activeCompany.id).eq('active', true)
        : Promise.resolve({ data: null }),
    ])
    if (memberRows) {
      setMembers(memberRows)
      const ids = memberRows.map((item) => item.user_id)
      if (ids.length) {
        const { data: profileRows } = await supabase.from('profiles').select('*').in('id', ids)
        setProfiles(Object.fromEntries((profileRows ?? []).map((item) => [item.id, item])))
      }
    }
    setCode(codeRows?.[0]?.code ?? '')
  }, [activeCompany, isAdmin, role, supabase])

  useEffect(() => {
    queueMicrotask(() => { void load() })
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
      setError(friendlySupabaseError(caught))
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
      setError(friendlySupabaseError(caught))
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
      setError(friendlySupabaseError(caught))
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
      setError(friendlySupabaseError(caught))
    }
  }

  if (!activeCompany) {
    return <Container><h1>Equipe</h1><Card><p>Nenhuma empresa ativa selecionada.</p></Card></Container>
  }
  if (role === 'employee' && !isAdmin) {
    return <Container><h1>Equipe</h1><Card><p>Esta área está disponível para proprietários e gerentes.</p></Card></Container>
  }

  return (
    <Container>
      <h1>Equipe — {activeCompany.name}</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <Card>
        {canViewCompanyCode(role, isAdmin) && (
          <div className="company-code">
            <span>Código atual</span>
            <strong>{code || 'Carregando...'}</strong>
            {isAdmin && <button className="secondary-button" type="button" onClick={rotateCode}>Trocar código</button>}
          </div>
        )}
      </Card>
      {canInvite(role, isAdmin, 'manager') && (
        <Card>
          <h2>Convidar por e-mail</h2>
          <form onSubmit={invite} className="form-grid">
            <label>E-mail<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /></label>
            {isAdmin && (
              <label>Cargo
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'owner' | 'manager')}>
                  <option value="manager">Gerente</option>
                  <option value="owner">Proprietário</option>
                </select>
              </label>
            )}
            <button className="primary-button" type="submit">Convidar</button>
          </form>
        </Card>
      )}
      <Card>
        <h2>Membros ativos</h2>
        <div className="member-list">
          {members.map((member) => {
            const targetRole = member.role as CompanyRole
            const deactivateAllowed = canDeactivate(role, isAdmin, targetRole, user?.id ?? '', member.user_id)
            return (
              <article className="member-row" key={member.id}>
                <div className="member-identity">
                  <Avatar
                    name={profiles[member.user_id]?.name}
                    googleUrl={undefined}
                    avatarKey={profiles[member.user_id]?.avatar_key}
                    storageBucket="profile-photos"
                    storagePath={profiles[member.user_id]?.avatar_url && !/^https?:/.test(profiles[member.user_id].avatar_url!) ? profiles[member.user_id].avatar_url : null}
                    size={44}
                  />
                  <span><strong>{profiles[member.user_id]?.name || 'Usuário sem nome'}</strong><small>{targetRole}</small></span>
                </div>
                <div className="member-actions">
                  {member.active && targetRole === 'employee' && canPromote(role, isAdmin) && (
                    <button className="secondary-button" type="button" onClick={() => promote(member.id)}>Promover</button>
                  )}
                  {deactivateAllowed && (
                    <button className="danger-button" type="button" onClick={() => deactivate(member.id)}>Desativar</button>
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
