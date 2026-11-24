import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  adminClient,
  anonClient,
  createTestUser,
  getAdminSession,
  loggedClient,
  loginUser,
  randomEmail,
  randomTestCode,
  rlsConfig,
  testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

suite('RLS Etapa 4 - equipe', () => {
  const admin = rlsConfig ? adminClient() : null
  const anon = rlsConfig ? anonClient() : null
  const users: User[] = []
  const clients = new Map<string, SupabaseClient>()
  const ids = new Map<string, string>()
  let companyA = ''
  let companyB = ''
  let codeA = ''
  let codeB = ''
  let temporaryAdminUserId: string | null = null
  let appAdmin: SupabaseClient | null = null

  function client(name: string): SupabaseClient {
    const result = clients.get(name)
    if (!result) throw new Error(`Cliente Etapa 4 Equipe não encontrado: ${name}`)
    return result
  }

  function id(name: string): string {
    const result = ids.get(name)
    if (!result) throw new Error(`ID Etapa 4 Equipe não encontrado: ${name}`)
    return result
  }

  function requireSuccess(error: { message: string } | null, operation: string) {
    if (error) throw new Error(`Falha no setup Etapa 4 Equipe (${operation}): ${error.message}`)
  }

  async function addUser(name: string) {
    if (!admin) throw new Error('Cliente de serviço Etapa 4 Equipe ausente')
    const email = randomEmail(name)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    ids.set(name, user.id)
    const session = await loginUser(email, password)
    clients.set(name, loggedClient(session.access_token))
    const identity = await anonClient().auth.getUser(session.access_token)
    if (identity.data.user?.id !== user.id) {
      throw new Error(`Nome/token Etapa 4 Equipe incoerente para ${name}`)
    }
  }

  beforeAll(async () => {
    if (!admin) return
    for (const name of [
      'et4-equipe-owner-a',
      'et4-equipe-manager-a',
      'et4-equipe-employee-a',
      'et4-equipe-owner-b',
    ]) {
      await addUser(name)
    }
    const adminSession = await getAdminSession()
    appAdmin = adminSession.client
    temporaryAdminUserId = adminSession.temporaryAdminUserId
    if (!adminSession.userId || !appAdmin) {
      throw new Error('Setup Etapa 4 Equipe não obteve sessão do admin.')
    }

    const companies = await admin.from('companies').insert([
      { name: 'rls-test-et4-equipe-empresa-a' },
      { name: 'rls-test-et4-equipe-empresa-b' },
    ]).select('id,name')
    requireSuccess(companies.error, 'empresas')
    companyA = companies.data?.find((row) => row.name === 'rls-test-et4-equipe-empresa-a')?.id ?? ''
    companyB = companies.data?.find((row) => row.name === 'rls-test-et4-equipe-empresa-b')?.id ?? ''
    if (!companyA || !companyB) throw new Error('Empresas Etapa 4 Equipe não retornadas')

    codeA = randomTestCode('ET4EA')
    codeB = randomTestCode('ET4EB')
    const codes = await admin.from('company_codes').insert([
      { company_id: companyA, code: codeA, version: 1, active: true, created_by: adminSession.userId },
      { company_id: companyB, code: codeB, version: 1, active: true, created_by: adminSession.userId },
    ]).select('id,company_id')
    requireSuccess(codes.error, 'códigos')
    const codeAId = codes.data?.find((row) => row.company_id === companyA)?.id
    if (!codeAId) throw new Error('Código Etapa 4 Equipe A não retornado')

    const memberships = await admin.from('memberships').insert([
      { company_id: companyA, user_id: id('et4-equipe-owner-a'), role: 'owner', active: true },
      { company_id: companyA, user_id: id('et4-equipe-manager-a'), role: 'manager', active: true },
      { company_id: companyA, user_id: id('et4-equipe-employee-a'), role: 'employee', active: true, code_id: codeAId },
      { company_id: companyB, user_id: id('et4-equipe-owner-b'), role: 'owner', active: true },
    ])
    requireSuccess(memberships.error, 'vínculos')
  })

  afterAll(async () => {
    if (!admin) return
    if (temporaryAdminUserId) {
      await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      await admin.auth.admin.deleteUser(temporaryAdminUserId)
    }
    if (companyA) await admin.from('companies').delete().eq('id', companyA)
    if (companyB) await admin.from('companies').delete().eq('id', companyB)
    await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
  })

  it('anon não executa get_team_members', async () => {
    if (!anon) throw new Error('Cliente anônimo ausente')
    const session = await anon.auth.getSession()
    expect(session.data.session).toBeNull()
    const result = await anon.rpc('get_team_members', { p_company_id: companyA })
    expect(result.error, 'anon executou get_team_members').not.toBeNull()
  })

  it('funcionário não executa get_team_members', async () => {
    const result = await client('et4-equipe-employee-a').rpc('get_team_members', { p_company_id: companyA })
    expect(result.error, 'funcionário executou get_team_members').not.toBeNull()
  })

  it('gerente e proprietário veem somente membros da própria empresa', async () => {
    for (const name of ['et4-equipe-manager-a', 'et4-equipe-owner-a']) {
      const result = await client(name).rpc('get_team_members', { p_company_id: companyA })
      expect(result.error, `${name}: ${result.error?.message ?? ''}`).toBeNull()
      const rows = result.data ?? []
      expect(rows.length).toBeGreaterThanOrEqual(3)
      expect(rows.every((row: { user_id: string }) => row.user_id !== id('et4-equipe-owner-b'))).toBe(true)
      expect(JSON.stringify(rows)).not.toContain(codeA)
      expect(JSON.stringify(rows)).not.toContain(codeB)
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ user_id: id('et4-equipe-owner-a'), role: 'owner', active: true }),
        expect.objectContaining({ user_id: id('et4-equipe-manager-a'), role: 'manager', active: true }),
        expect.objectContaining({ user_id: id('et4-equipe-employee-a'), role: 'employee', active: true }),
      ]))
    }
  })

  it('admin da aplicação executa e não recebe dados da empresa B', async () => {
    if (!appAdmin) throw new Error('Admin da aplicação ausente')
    const result = await appAdmin.rpc('get_team_members', { p_company_id: companyA })
    expect(result.error).toBeNull()
    expect(result.data?.every((row: { user_id: string }) => row.user_id !== id('et4-equipe-owner-b'))).toBe(true)
    const wrong = await appAdmin.rpc('get_team_members', { p_company_id: companyB })
    expect(wrong.error).toBeNull()
    expect(wrong.data?.every((row: { user_id: string }) => row.user_id === id('et4-equipe-owner-b'))).toBe(true)
  })

  it('conta nova entra por código como funcionário e não entra em empresa suspensa', async () => {
    if (!appAdmin || !admin) throw new Error('Clientes RLS ausentes')
    const email = randomEmail('et4-equipe-new-user')
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    const session = await loginUser(email, password)
    const employeeNew = loggedClient(session.access_token)

    const join = await employeeNew.rpc('join_company_with_code', { p_code: codeA })
    expect(join.error).toBeNull()
    expect(join.data).toBeTruthy()

    const team = await client('et4-equipe-owner-a').rpc('get_team_members', { p_company_id: companyA })
    expect(team.error).toBeNull()
    expect((team.data ?? []).some((row: { user_id: string }) => row.user_id === user.id)).toBe(true)

    const suspend = await appAdmin.rpc('suspend_company', {
      p_company_id: companyA,
      p_reason: 'teste de entrada por código',
    })
    expect(suspend.error).toBeNull()
    const suspendedJoin = await employeeNew.rpc('join_company_with_code', { p_code: codeA })
    expect(suspendedJoin.error?.message).toContain('empresa suspensa')

    const reactivate = await appAdmin.rpc('reactivate_company', {
      p_company_id: companyA,
    })
    expect(reactivate.error).toBeNull()
  })

  it('proprietário desativa com motivo, funcionário perde acesso e proprietário reativa', async () => {
    const owner = client('et4-equipe-owner-a')
    const employee = client('et4-equipe-employee-a')

    const before = await owner.rpc('get_team_members', { p_company_id: companyA })
    expect(before.error).toBeNull()
    const employeeRow = (before.data ?? []).find((row: { user_id: string }) =>
      row.user_id === id('et4-equipe-employee-a'),
    ) as { membership_id: string } | undefined
    expect(employeeRow?.membership_id).toBeTruthy()

    const deactivate = await owner.rpc('deactivate_member', {
      p_membership_id: employeeRow!.membership_id,
      p_reason: 'troca de responsável pelo turno',
    })
    expect(deactivate.error).toBeNull()

    const inactive = await owner.rpc('get_team_members', { p_company_id: companyA })
    expect(inactive.error).toBeNull()
    const inactiveRow = (inactive.data ?? []).find((row: { user_id: string }) =>
      row.user_id === id('et4-equipe-employee-a'),
    ) as { active: boolean; deactivated_reason: string } | undefined
    expect(inactiveRow?.active).toBe(false)
    expect(inactiveRow?.deactivated_reason).toBe('troca de responsável pelo turno')

    expect((await employee.rpc('get_team_members', { p_company_id: companyA })).error).not.toBeNull()

    const reactivate = await owner.rpc('reactivate_member', {
      p_membership_id: employeeRow!.membership_id,
    })
    expect(reactivate.error).toBeNull()

    const after = await owner.rpc('get_team_members', { p_company_id: companyA })
    expect(after.error).toBeNull()
    const activeRow = (after.data ?? []).find((row: { user_id: string }) =>
      row.user_id === id('et4-equipe-employee-a'),
    ) as { active: boolean; deactivated_reason: string | null } | undefined
    expect(activeRow?.active).toBe(true)
    expect(activeRow?.deactivated_reason).toBeNull()
  })

  it('funcionário não desativa nem reativa vínculo', async () => {
    const employee = client('et4-equipe-employee-a')
    const owner = client('et4-equipe-owner-a')
    const members = await owner.rpc('get_team_members', { p_company_id: companyA })
    expect(members.error).toBeNull()
    const employeeRow = (members.data ?? []).find((row: { user_id: string }) =>
      row.user_id === id('et4-equipe-employee-a'),
    ) as { membership_id: string } | undefined
    expect(employeeRow?.membership_id).toBeTruthy()
    expect((await employee.rpc('deactivate_member', {
      p_membership_id: employeeRow!.membership_id,
      p_reason: 'proibido',
    })).error).not.toBeNull()
    expect((await employee.rpc('reactivate_member', {
      p_membership_id: employeeRow!.membership_id,
    })).error).not.toBeNull()
  })

  it('admin suspende empresa, bloqueia operações e reativa', async () => {
    if (!appAdmin) throw new Error('Admin da aplicação ausente')
    const owner = client('et4-equipe-owner-a')
    const employee = client('et4-equipe-employee-a')

    const suspend = await appAdmin.rpc('suspend_company', {
      p_company_id: companyA,
      p_reason: 'manutenção operacional',
    })
    expect(suspend.error).toBeNull()

    expect((await owner.rpc('get_team_members', { p_company_id: companyA })).error).not.toBeNull()
    expect((await employee.rpc('get_team_members', { p_company_id: companyA })).error).not.toBeNull()

    const update = await owner
      .from('companies')
      .update({ phone: '11999999999' })
      .eq('id', companyA)
      .select('id')
    expect(update.error || (update.data ?? []).length === 0).toBeTruthy()

    const reactivate = await appAdmin.rpc('reactivate_company', {
      p_company_id: companyA,
    })
    expect(reactivate.error).toBeNull()

    const ownerAgain = await owner.rpc('get_team_members', { p_company_id: companyA })
    expect(ownerAgain.error).toBeNull()
  })
})
