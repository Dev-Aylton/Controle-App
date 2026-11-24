import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import type { CompanyRole } from '../lib/database.types'

export type TeamMember = {
  membershipId: string
  userId: string
  name: string
  email: string | null
  role: CompanyRole
  active: boolean
  createdAt: string
  deactivatedAt?: string | null
  deactivatedBy?: string | null
  deactivatedReason?: string | null
}

type RpcTeamMember = {
  membership_id: string
  user_id: string
  name: string
  email: string | null
  role: CompanyRole
  active: boolean
  created_at: string
  deactivated_at: string | null
  deactivated_by: string | null
  deactivated_reason: string | null
}

export async function getTeamMembers(companyId: string): Promise<TeamMember[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase.rpc('get_team_members', { p_company_id: companyId })
  if (error) throw new Error(friendlySupabaseError(error))
  return ((data ?? []) as RpcTeamMember[]).map((member) => ({
    membershipId: member.membership_id,
    userId: member.user_id,
    name: member.name,
    email: member.email,
    role: member.role,
    active: member.active,
    createdAt: member.created_at,
    deactivatedAt: member.deactivated_at,
    deactivatedBy: member.deactivated_by,
    deactivatedReason: member.deactivated_reason,
  }))
}
