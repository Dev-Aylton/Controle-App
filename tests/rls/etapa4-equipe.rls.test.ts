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
})
