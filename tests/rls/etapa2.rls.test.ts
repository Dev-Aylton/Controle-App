import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import {
  adminClient,
  anonClient,
  createTestUser,
  loggedClient,
  loginUser,
  randomEmail,
  rlsConfig,
  randomTestCode,
  testPassword,
  getAdminSession,
} from '../rls/helpers'

const suite = rlsConfig ? describe : describe.skip
if (!rlsConfig) console.info('RLS Etapa 2 ignorado: faltam variáveis em .env.test.')

suite('RLS Etapa 2 - ambientes e produtos', () => {
  const admin = rlsConfig ? adminClient() : null as unknown as ReturnType<typeof adminClient>
  // Cliente anônimo dedicado: nunca passe este cliente para loginUser/verifyOtp/setSession.
  const anon = rlsConfig ? anonClient() : null as unknown as ReturnType<typeof anonClient>
  const users: User[] = []
  const createdUsers = new Map<string, { id: string; email: string }>()
  const clients = new Map<string, ReturnType<typeof loggedClient>>()
  let companyA = ''
  let companyB = ''
  let productA = ''
  let productB = ''
  let codeAId = ''
  let companyAId = ''
  let companyBId = ''
  let temporaryAdminUserId: string | null = null
  let adminSessionUserId = ''

  async function addUser(name: string) {
    const email = randomEmail(name)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    createdUsers.set(name, { id: user.id, email })
    const session = await loginUser(email, password)
    clients.set(name, loggedClient(session.access_token))
    return user
  }

  beforeAll(async () => {
    try {
    const [ownerA, managerA, employeeA, ownerB] = await Promise.all([
      addUser('et2-owner-a'),
      addUser('et2-manager-a'),
      addUser('et2-employee-a'),
      addUser('et2-owner-b'),
    ])
    const adminSession = await getAdminSession()
    adminSessionUserId = adminSession.userId
    temporaryAdminUserId = adminSession.temporaryAdminUserId

    const companyAResult = await admin
      .from('companies')
      .insert({ name: 'rls-test-et2-empresa-a' })
      .select('id')
      .single()
    if (companyAResult.error || !companyAResult.data?.id) {
      throw new Error(`Falha ao criar empresa A Etapa 2: ${companyAResult.error?.message ?? 'ID não retornado'}${companyAResult.error?.code ? ` [${companyAResult.error.code}]` : ''}`)
    }
    companyA = companyAResult.data.id
    companyAId = companyA

    const companyBResult = await admin
      .from('companies')
      .insert({ name: 'rls-test-et2-empresa-b' })
      .select('id')
      .single()
    if (companyBResult.error || !companyBResult.data?.id) {
      throw new Error(`Falha ao criar empresa B Etapa 2: ${companyBResult.error?.message ?? 'ID não retornado'}${companyBResult.error?.code ? ` [${companyBResult.error.code}]` : ''}`)
    }
    companyB = companyBResult.data.id
    companyBId = companyB

    const { data: codeRows, error: codeError } = await admin.from('company_codes').insert([
      { company_id: companyA, code: randomTestCode('ET2A'), version: 1, active: true, created_by: adminSessionUserId },
      { company_id: companyB, code: randomTestCode('ET2B'), version: 1, active: true, created_by: adminSessionUserId },
    ]).select('*')
    if (codeError) throw new Error(`Falha ao preparar códigos Etapa 2: ${codeError.message}${codeError.code ? ` [${codeError.code}]` : ''}`)
    codeAId = codeRows?.find((code) => code.company_id === companyA)?.id ?? ''

    const membershipResult = await admin.from('memberships').insert([
      { user_id: ownerA.id, company_id: companyA, role: 'owner', active: true },
      { user_id: managerA.id, company_id: companyA, role: 'manager', active: true },
      { user_id: employeeA.id, company_id: companyA, role: 'employee', active: true, code_id: codeAId },
      { user_id: ownerB.id, company_id: companyB, role: 'owner', active: true },
    ])
    if (membershipResult.error) throw new Error(`Falha ao preparar vínculos Etapa 2: ${membershipResult.error.message}${membershipResult.error.code ? ` [${membershipResult.error.code}]` : ''}`)

    const productResult = await admin.from('products').insert([
      { company_id: companyA, name: 'rls-test-produto-a', sku: 'rls-test-et2-a', unit: 'un', min_stock: 1, active: true },
      { company_id: companyB, name: 'rls-test-produto-b', sku: 'rls-test-et2-b', unit: 'un', min_stock: 1, active: true },
    ]).select('*')
    if (productResult.error) throw new Error(`Falha ao preparar produtos Etapa 2: ${productResult.error.message}${productResult.error.code ? ` [${productResult.error.code}]` : ''}`)
    const products = productResult.data
    if (!products) throw new Error('Falha ao preparar produtos Etapa 2: dados não retornados.')
    productA = products.find((product) => product.company_id === companyA)?.id ?? ''
    productB = products.find((product) => product.company_id === companyB)?.id ?? ''
    } catch (caught) {
      if (companyAId) await admin.from('companies').delete().eq('id', companyAId)
      if (companyBId) await admin.from('companies').delete().eq('id', companyBId)
      if (temporaryAdminUserId) await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
      if (temporaryAdminUserId) await admin.auth.admin.deleteUser(temporaryAdminUserId)
      throw caught
    }
  })

  afterAll(async () => {
    if (!rlsConfig) return
    try {
      if (temporaryAdminUserId) {
        await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      }
      if (companyAId) await admin.from('companies').delete().eq('id', companyAId)
      if (companyBId) await admin.from('companies').delete().eq('id', companyBId)
    } finally {
      await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
      if (temporaryAdminUserId) await admin.auth.admin.deleteUser(temporaryAdminUserId)
    }
  })

  it('anon não lê ambientes, categorias, produtos ou custos', async () => {
    const { data: sess } = await anon.auth.getSession()
    expect(sess.session, 'cliente anon tem sessão ativa').toBeNull()
    for (const table of ['environments', 'product_categories', 'products', 'product_costs', 'product_cost_history']) {
      const result = await anon.from(table).select('*').limit(1)
      expect(Boolean(result.error) || (result.data ?? []).length === 0, `anon leu ou obteve acesso inesperado na tabela ${table}`).toBe(true)
    }
  })

  it('usuário da empresa A não lê nem altera dados da empresa B', async () => {
    const employee = clients.get('et2-employee-a')
    const products = await employee!.from('products').select('*').eq('company_id', companyB)
    expect(products.data ?? [], 'funcionário da empresa A leu produtos da empresa B').toHaveLength(0)
    const environmentUpdate = await employee!.from('environments').update({ name: 'Proibido' }).eq('company_id', companyB).select('*')
    expect(environmentUpdate.data ?? [], 'funcionário da empresa A alterou ambiente da empresa B').toHaveLength(0)
  })

  it('funcionário lê produtos mas não lê custos nem histórico', async () => {
    const employee = clients.get('et2-employee-a')
    const products = await employee!.from('products').select('*').eq('company_id', companyA)
    expect(products.data?.length ?? 0, 'funcionário não viu produto da própria empresa').toBeGreaterThan(0)
    const costs = await employee!.from('product_costs').select('*').eq('company_id', companyA)
    expect(costs.data ?? [], 'funcionário leu custo de produto').toHaveLength(0)
    const history = await employee!.from('product_cost_history').select('*').eq('company_id', companyA)
    expect(history.data ?? [], 'funcionário leu histórico de custo').toHaveLength(0)
  })

  it('funcionário não cria ou edita ambiente e produto', async () => {
    const employee = clients.get('et2-employee-a')
    const env = await employee!.from('environments').insert({ company_id: companyA, name: 'Proibido', active: true }).select('*')
    expect(env.error).not.toBeNull()
    const product = await employee!.from('products').update({ name: 'Proibido' }).eq('id', productA).select('*')
    expect(product.data ?? []).toHaveLength(0)
  })

  it('gerente cria ambiente e produto', async () => {
    const manager = clients.get('et2-manager-a')
    const env = await manager!.from('environments').insert({ company_id: companyA, name: 'rls-test-bar', active: true }).select('*')
    expect(env.error).toBeNull()
    expect(env.data?.length).toBe(1)
    const product = await manager!.from('products').insert({ company_id: companyA, name: 'rls-test-produto-gerente', unit: 'un', active: true }).select('*')
    expect(product.error).toBeNull()
  })

  it('histórico de custo é imutável', async () => {
    const owner = clients.get('et2-owner-a')
    await owner!.rpc('upsert_product_cost', { p_product_id: productA, p_unit_cost: 12.5 })
    const history = await owner!.from('product_cost_history').select('*').eq('product_id', productA)
    expect(history.data?.length ?? 0).toBeGreaterThan(0)
    if (history.data?.[0]) {
      const update = await owner!.from('product_cost_history').update({ unit_cost: 1 }).eq('id', history.data[0].id).select('*')
      expect(update.data ?? []).toHaveLength(0)
      const remove = await owner!.from('product_cost_history').delete().eq('id', history.data[0].id).select('*')
      expect(remove.data ?? []).toHaveLength(0)
    }
  })

  it('produto de outra empresa não recebe custo pelo RPC', async () => {
    const owner = clients.get('et2-owner-a')
    const result = await owner!.rpc('upsert_product_cost', { p_product_id: productB, p_unit_cost: 10 })
    expect(result.error).not.toBeNull()
  })
})
