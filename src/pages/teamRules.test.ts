import { describe, expect, it } from 'vitest'
import { buildTeamMemberViews, filterTeamMemberViews, getTeamRoleLabel } from './teamRules'

describe('TeamPage - membros', () => {
  it('não retorna estado vazio para o admin e mostra seus dados atuais', () => {
    const result = buildTeamMemberViews({
      members: [],
      currentUserId: 'admin-1',
      currentUserName: 'Admin Teste',
      currentUserEmail: 'admin@example.com',
      isAdmin: true,
    })
    expect(result).toEqual([
      expect.objectContaining({
        membershipId: 'app-admin',
        name: 'Admin Teste',
        email: 'admin@example.com',
        role: 'owner',
        active: true,
      }),
    ])
  })

  it('não duplica o admin quando já existe membership', () => {
    const member = {
      membershipId: 'membership-1',
      userId: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'owner',
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
    } as const
    const result = buildTeamMemberViews({
      members: [member],
      currentUserId: 'admin-1',
      currentUserName: 'Admin',
      isAdmin: true,
    })
    expect(result).toHaveLength(1)
    expect(result[0].membershipId).toBe('membership-1')
  })

  it('filtra membros por nome, cargo e status', () => {
    const members = buildTeamMemberViews({
      members: [
        { membershipId: '1', userId: 'u1', name: 'Mariana Souza', email: 'mariana@example.com', role: 'employee', active: true, createdAt: '2026-01-01T00:00:00Z' },
        { membershipId: '2', userId: 'u2', name: 'Carlos Lima', email: 'carlos@example.com', role: 'manager', active: false, createdAt: '2026-01-01T00:00:00Z' },
      ],
      isAdmin: false,
    })
    expect(filterTeamMemberViews(members, { search: 'mariana', role: 'employee', status: 'ativos' })).toHaveLength(1)
    expect(filterTeamMemberViews(members, { search: '', role: 'todos', status: 'inativos' }).map((member) => member.name)).toEqual(['Carlos Lima'])
  })

  it('usa nomes claros para os cargos', () => {
    expect(getTeamRoleLabel('owner')).toBe('Proprietário')
    expect(getTeamRoleLabel('manager')).toBe('Gerente')
    expect(getTeamRoleLabel('employee')).toBe('Funcionário')
  })
})
