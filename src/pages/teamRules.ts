import type { TeamMember } from '../services/team'
import type { CompanyRole } from '../lib/database.types'

export type TeamMemberView = {
  membershipId: string
  userId: string
  name: string
  email: string | null
  role: CompanyRole
  active: boolean
  avatarUrl: string | null
  avatarKey: string | null
  deactivatedAt: string | null
  deactivatedReason: string | null
}

export type TeamMemberFilter = {
  search: string
  role: 'todos' | CompanyRole
  status: 'todos' | 'ativos' | 'inativos'
}

export function filterTeamMemberViews(members: TeamMemberView[], filter: TeamMemberFilter) {
  const search = filter.search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return members.filter((member) => {
    const memberText = `${member.name} ${member.email ?? ''}`.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    const roleMatches = filter.role === 'todos' || member.role === filter.role
    const statusMatches = filter.status === 'todos'
      || (filter.status === 'ativos' && member.active)
      || (filter.status === 'inativos' && !member.active)
    return (!search || memberText.includes(search)) && roleMatches && statusMatches
  })
}

export function getTeamRoleLabel(role: CompanyRole) {
  const labels: Record<CompanyRole, string> = {
    owner: 'Proprietário',
    manager: 'Gerente',
    employee: 'Funcionário',
  }
  return labels[role]
}

type BuildTeamMemberViewsInput = {
  members: TeamMember[]
  currentUserId?: string
  currentUserName?: string
  currentUserEmail?: string
  isAdmin: boolean
}

export function buildTeamMemberViews(input: BuildTeamMemberViewsInput): TeamMemberView[] {
  const views = input.members.map((member) => {
    const isCurrentUser = member.userId === input.currentUserId
    return {
      membershipId: member.membershipId,
      userId: member.userId,
      name: member.name || (isCurrentUser ? input.currentUserName ?? 'Usuário sem nome' : 'Usuário sem nome'),
      email: member.email ?? (isCurrentUser ? input.currentUserEmail ?? null : null),
      role: member.role,
      active: member.active,
      avatarUrl: null,
      avatarKey: null,
      deactivatedAt: member.deactivatedAt ?? null,
      deactivatedReason: member.deactivatedReason ?? null,
    }
  })
  if (
    input.isAdmin
    && input.currentUserId
    && !views.some((member) => member.userId === input.currentUserId)
  ) {
    views.unshift({
      membershipId: 'app-admin',
      userId: input.currentUserId,
      name: input.currentUserName ?? 'Administrador',
      email: input.currentUserEmail ?? null,
      role: 'owner',
      active: true,
      avatarUrl: null,
      avatarKey: null,
      deactivatedAt: null,
      deactivatedReason: null,
    })
  }
  return views
}
