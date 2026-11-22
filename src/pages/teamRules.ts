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
    })
  }
  return views
}
