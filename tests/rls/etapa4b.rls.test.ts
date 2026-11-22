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

suite('RLS Etapa 4B - compras e motivos de perda', () => {
  const admin = rlsConfig ? adminClient() : null
  const anon = rlsConfig ? anonClient() : null
  const users: User[] = []
  const clients = new Map<string, SupabaseClient>()
  const ids = new Map<string, string>()
  let companyA = ''
  let companyB = ''
  let environmentA = ''
  let reasonId = ''
  let employeeLossId = ''
  let temporaryAdminUserId: string | null = null
  let appAdminUserId = ''
  let appAdmin: SupabaseClient | null = null

  function client(name: string): SupabaseClient {
    const value = clients.get(name)
    if (!value) throw new Error(`Cliente Etapa 4B não encontrado: ${name}`)
    return value
  }
  function id(name: string): string {
    const value = ids.get(name)
    if (!value) throw new Error(`ID Etapa 4B não encontrado: ${name}`)
    return value
  }
  function requireSuccess(error: { message: string } | null, operation: string) {
    if (error) throw new Error(`Falha no setup Etapa 4B (${operation}): ${error.message}`)
  }
  async function addUser(name: string) {
    if (!admin) throw new Error('Cliente de serviço Etapa 4B ausente')
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
      addUser('et4b-owner-a'),
      addUser('et4b-manager-a'),
      addUser('et4b-employee-a'),
      addUser('et4b-owner-b'),
    ])
    const adminSession = await getAdminSession()
    appAdmin = adminSession.client
    appAdminUserId = adminSession.userId
    temporaryAdminUserId = adminSession.temporaryAdminUserId

    const companies = await admin.from('companies').insert([
      { name: 'rls-test-et4b-empresa-a' },
      { name: 'rls-test-et4b-empresa-b' },
    ]).select('id,name')
    requireSuccess(companies.error, 'empresas')
    companyA = companies.data?.find((row) => row.name === 'rls-test-et4b-empresa-a')?.id ?? ''
    companyB = companies.data?.find((row) => row.name === 'rls-test-et4b-empresa-b')?.id ?? ''
    if (!companyA || !companyB) throw new Error('Empresas Etapa 4B não retornadas')

    const codes = await admin.from('company_codes').insert([
      { company_id: companyA, code: randomTestCode('ET4BA'), version: 1, active: true, created_by: adminSession.userId },
      { company_id: companyB, code: randomTestCode('ET4BB'), version: 1, active: true, created_by: adminSession.userId },
    ]).select('id,company_id')
    requireSuccess(codes.error, 'códigos')
    const codeA = codes.data?.find((row) => row.company_id === companyA)?.id
    if (!codeA) throw new Error('Código Etapa 4B A não retornado')

    const memberships = await admin.from('memberships').insert([
      { company_id: companyA, user_id: id('et4b-owner-a'), role: 'owner', active: true },
      { company_id: companyA, user_id: id('et4b-manager-a'), role: 'manager', active: true },
      { company_id: companyA, user_id: id('et4b-employee-a'), role: 'employee', active: true, code_id: codeA },
      { company_id: companyB, user_id: id('et4b-owner-b'), role: 'owner', active: true },
    ])
    requireSuccess(memberships.error, 'vínculos')

    const environments = await admin.from('environments').insert([
      { company_id: companyA, name: 'rls-test-et4b-bar-a', active: true },
      { company_id: companyB, name: 'rls-test-et4b-bar-b', active: true },
    ]).select('id,name')
    requireSuccess(environments.error, 'ambientes')
    environmentA = environments.data?.find((row) => row.name === 'rls-test-et4b-bar-a')?.id ?? ''

    const products = await admin.from('products').insert([
      { company_id: companyA, name: 'rls-test-et4b-produto-a', sku: 'et4b-a', unit: 'un', min_stock: 5, max_stock: 10, active: true },
      { company_id: companyB, name: 'rls-test-et4b-produto-b', sku: 'et4b-b', unit: 'un', min_stock: 3, max_stock: null, active: true },
    ]).select('id,name')
    requireSuccess(products.error, 'produtos')
    const productA = products.data?.find((row) => row.name === 'rls-test-et4b-produto-a')?.id
    const productB = products.data?.find((row) => row.name === 'rls-test-et4b-produto-b')?.id
    if (!productA || !productB) throw new Error('Produtos Etapa 4B não retornados')
    ids.set('et4b-product-a', productA)
    ids.set('et4b-product-b', productB)

    const reason = await admin.from('loss_reasons').insert({
      company_id: companyA, name: 'Quebra', active: true, created_by: adminSession.userId,
    }).select('id').single()
    requireSuccess(reason.error, 'motivo de perda')
    if (!reason.data) throw new Error('Motivo Etapa 4B não retornado')
    reasonId = reason.data.id

    const entry = await client('et4b-owner-a').rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 2,
    })
    requireSuccess(entry.error, 'entrada para perda')
    const loss = await client('et4b-employee-a').rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'perda', p_quantity: 1,
    })
    requireSuccess(loss.error, 'perda pendente')
    if (!loss.data) throw new Error('Movimento de perda Etapa 4B não retornado')
    employeeLossId = loss.data
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

  it('anon não executa nenhuma RPC nova', async () => {
    if (!anon) throw new Error('Cliente anônimo ausente')
    const session = await anon.auth.getSession()
    expect(session.data.session).toBeNull()
    for (const name of ['get_purchase_list', 'get_pending_loss_reasons', 'complete_pending_loss_reason', 'list_loss_reasons']) {
      const args = name === 'complete_pending_loss_reason'
        ? { p_movement_id: employeeLossId, p_reason_id: reasonId }
        : { p_company_id: companyA }
      const result = await anon.rpc(name, args)
      expect(result.error, `anon executou ${name}`).not.toBeNull()
    }
  })

  it('funcionário não lista compras nem motivos pendentes da empresa', async () => {
    const employee = client('et4b-employee-a')
    expect((await employee.rpc('get_purchase_list', { p_company_id: companyA })).error).not.toBeNull()
    expect((await employee.rpc('get_pending_loss_reasons', { p_company_id: companyA })).error).not.toBeNull()
  })

  it('funcionário completa apenas sua própria perda', async () => {
    const employee = client('et4b-employee-a')
    const complete = await employee.rpc('complete_pending_loss_reason', {
      p_movement_id: employeeLossId, p_reason_id: reasonId,
    })
    expect(complete.error).toBeNull()
    const audit = await appAdmin.from('audit_log').select('user_id,acted_as_support')
      .eq('company_id', companyA).eq('action', 'loss_reason_completed')
      .order('created_at', { ascending: false }).limit(1)
    expect(audit.error).toBeNull()
    expect(audit.data?.[0]?.user_id).toBe(id('et4b-employee-a'))
    expect(audit.data?.[0]?.acted_as_support).toBe(false)
  })

  it('outra empresa não lista compras nem motivos', async () => {
    const ownerB = client('et4b-owner-b')
    expect((await ownerB.rpc('get_purchase_list', { p_company_id: companyA })).error).not.toBeNull()
    expect((await ownerB.rpc('get_pending_loss_reasons', { p_company_id: companyA })).error).not.toBeNull()
  })

  it('gerente e proprietário listam compras e pendências', async () => {
    for (const name of ['et4b-manager-a', 'et4b-owner-a']) {
      const purchase = await client(name).rpc('get_purchase_list', { p_company_id: companyA })
      expect(purchase.error).toBeNull()
      const pending = await client(name).rpc('get_pending_loss_reasons', { p_company_id: companyA })
      expect(pending.error).toBeNull()
    }
  })

  it('admin lê a lista de compras e completa motivo como suporte', async () => {
    if (!appAdmin) throw new Error('Admin Etapa 4B ausente')
    const purchase = await appAdmin.rpc('get_purchase_list', { p_company_id: companyA })
    expect(purchase.error).toBeNull()
    const loss = await appAdmin.rpc('register_movement', {
      p_company_id: companyA,
      p_product_id: id('et4b-product-a'),
      p_environment_id: environmentA,
      p_type: 'perda',
      p_quantity: 1,
    })
    expect(loss.error).toBeNull()
    if (!loss.data) throw new Error('Perda do admin Etapa 4B não retornada')
    const complete = await appAdmin.rpc('complete_pending_loss_reason', {
      p_movement_id: loss.data, p_reason_id: reasonId,
    })
    expect(complete.error).toBeNull()
    const audit = await appAdmin.from('audit_log').select('user_id,acted_as_support')
      .eq('company_id', companyA).eq('action', 'loss_reason_completed')
      .order('created_at', { ascending: false }).limit(1)
    expect(audit.error).toBeNull()
    expect(audit.data?.[0]?.user_id).toBe(appAdminUserId)
    expect(audit.data?.[0]?.acted_as_support).toBe(true)
  })
})
