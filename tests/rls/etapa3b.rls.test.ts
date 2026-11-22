import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  adminClient, anonClient, createTestUser, getAdminSession, loggedClient, loginUser,
  randomEmail, randomTestCode, rlsConfig, testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

suite('RLS Etapa 3B - dose e zeragem', () => {
  const admin = rlsConfig ? adminClient() : null
  const anon = rlsConfig ? anonClient() : null
  const users: User[] = []
  const clients = new Map<string, SupabaseClient>()
  const ids = new Map<string, string>()
  let companyA = ''
  let companyB = ''
  let environmentA = ''
  let environmentB = ''
  let productA = ''
  let temporaryAdminUserId: string | null = null
  let appAdmin: SupabaseClient | null = null

  function client(name: string): SupabaseClient {
    const value = clients.get(name)
    if (!value) throw new Error(`Cliente Etapa 3B não encontrado: ${name}`)
    return value
  }
  function requireSuccess(error: { message: string } | null, operation: string) {
    if (error) throw new Error(`Falha no setup Etapa 3B (${operation}): ${error.message}`)
  }
  async function addUser(name: string) {
    if (!admin) throw new Error('Cliente Etapa 3B ausente')
    const email = randomEmail(name)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    ids.set(name, user.id)
    const session = await loginUser(email, password)
    clients.set(name, loggedClient(session.access_token))
  }

  beforeAll(async () => {
    if (!admin) return
    await Promise.all([
      addUser('e3b-owner-a'), addUser('e3b-manager-a'), addUser('e3b-employee-a'), addUser('e3b-owner-b'),
    ])
    const session = await getAdminSession()
    appAdmin = session.client
    temporaryAdminUserId = session.temporaryAdminUserId
    const companies = await admin.from('companies').insert([
      { name: 'rls-test-e3b-a' }, { name: 'rls-test-e3b-b' },
    ]).select('id,name')
    requireSuccess(companies.error, 'empresas')
    companyA = companies.data?.find((row) => row.name === 'rls-test-e3b-a')?.id ?? ''
    companyB = companies.data?.find((row) => row.name === 'rls-test-e3b-b')?.id ?? ''
    const codes = await admin.from('company_codes').insert([
      { company_id: companyA, code: randomTestCode('E3BA'), version: 1, active: true, created_by: session.userId },
      { company_id: companyB, code: randomTestCode('E3BB'), version: 1, active: true, created_by: session.userId },
    ]).select('id,company_id')
    requireSuccess(codes.error, 'códigos')
    const codeA = codes.data?.find((row) => row.company_id === companyA)?.id
    const codeB = codes.data?.find((row) => row.company_id === companyB)?.id
    if (!codeA || !codeB) throw new Error('Códigos Etapa 3B não retornados')
    const memberships = await admin.from('memberships').insert([
      { company_id: companyA, user_id: ids.get('e3b-owner-a'), role: 'owner', active: true },
      { company_id: companyA, user_id: ids.get('e3b-manager-a'), role: 'manager', active: true },
      { company_id: companyA, user_id: ids.get('e3b-employee-a'), role: 'employee', active: true, code_id: codeA },
      { company_id: companyB, user_id: ids.get('e3b-owner-b'), role: 'owner', active: true, code_id: null },
    ])
    requireSuccess(memberships.error, 'vínculos')
    const environments = await admin.from('environments').insert([
      { company_id: companyA, name: 'rls-test-e3b-a', active: true },
      { company_id: companyB, name: 'rls-test-e3b-b', active: true },
    ]).select('id,name')
    requireSuccess(environments.error, 'ambientes')
    environmentA = environments.data?.find((row) => row.name === 'rls-test-e3b-a')?.id ?? ''
    environmentB = environments.data?.find((row) => row.name === 'rls-test-e3b-b')?.id ?? ''
    const products = await admin.from('products').insert([
      { company_id: companyA, name: 'rls-test-e3b-produto', unit: 'un', min_stock: 1, volume_ml: 998, dose_ml: 50, active: true },
    ]).select('id')
    requireSuccess(products.error, 'produtos')
    productA = products.data?.[0]?.id ?? ''
    if (!productA || !environmentA || !environmentB) throw new Error('Setup Etapa 3B incompleto')
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

  it('anon não executa zeragem ou dose', async () => {
    if (!anon) throw new Error('Cliente anônimo ausente')
    expect((await anon.rpc('zero_stock', { p_company_id: companyA, p_environment_id: environmentA })).error).not.toBeNull()
  })

  it('funcionário não zera e admin não lança dose', async () => {
    expect((await client('e3b-employee-a').rpc('zero_stock', { p_company_id: companyA, p_environment_id: environmentA, p_reason: 'teste' })).error).not.toBeNull()
  })

  it('gerente lança entrada por dose e zera um produto', async () => {
    const manager = client('e3b-manager-a')
    const entry = await manager.rpc('register_dose_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_kind: 'entrada', p_doses: 38,
    })
    expect(entry.error).toBeNull()
    const zero = await manager.rpc('zero_stock', {
      p_company_id: companyA, p_environment_id: environmentA, p_product_id: productA, p_reason: 'Zeragem teste',
    })
    expect(zero.error).toBeNull()
  })

  it('proprietário zera todos e a zeragem pode ser estornada', async () => {
    const owner = client('e3b-owner-a')
    const entry = await owner.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 2,
    })
    expect(entry.error).toBeNull()
    const zero = await owner.rpc('zero_stock', {
      p_company_id: companyA, p_environment_id: environmentA, p_product_id: null, p_reason: 'Zerar ambiente',
    })
    expect(zero.error).toBeNull()
  })

  it('outra empresa não zera', async () => {
    const ownerB = client('e3b-owner-b')
    expect((await ownerB.rpc('zero_stock', { p_company_id: companyA, p_environment_id: environmentA, p_reason: 'proibido' })).error).not.toBeNull()
  })

  it('admin zera e lança dose como suporte', async () => {
    if (!appAdmin) throw new Error('Admin Etapa 3B ausente')
    const dose = await appAdmin.rpc('register_dose_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_kind: 'entrada', p_doses: 1,
    })
    expect(dose.error).toBeNull()
    const zero = await appAdmin.rpc('zero_stock', {
      p_company_id: companyA, p_environment_id: environmentA, p_product_id: productA, p_reason: 'suporte',
    })
    expect(zero.error).toBeNull()
    const audit = await appAdmin.from('audit_log').select('acted_as_support')
      .eq('company_id', companyA).eq('action', 'stock_zeroed').order('created_at', { ascending: false }).limit(1)
    expect(audit.error).toBeNull()
    expect(audit.data?.[0]?.acted_as_support).toBe(true)
  })
})
