import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  adminClient, anonClient, createTestUser, getAdminSession, loggedClient, loginUser,
  randomEmail, randomTestCode, rlsConfig, testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

suite('RLS Etapa 5A - vendas e fila', () => {
  const admin = rlsConfig ? adminClient() : null
  const anon = rlsConfig ? anonClient() : null
  const users: User[] = []
  const clients = new Map<string, SupabaseClient>()
  const ids = new Map<string, string>()
  let companyA = ''
  let companyB = ''
  let environmentA = ''
  let environmentC = ''
  let productA = ''
  let temporaryAdminUserId: string | null = null
  let appAdmin: SupabaseClient | null = null

  function client(name: string): SupabaseClient {
    const value = clients.get(name)
    if (!value) throw new Error(`Cliente Etapa 5A não encontrado: ${name}`)
    return value
  }
  function requireSuccess(error: { message: string } | null, operation: string) {
    if (error) throw new Error(`Falha no setup Etapa 5A (${operation}): ${error.message}`)
  }
  async function addUser(name: string) {
    if (!admin) throw new Error('Cliente Etapa 5A ausente')
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
      addUser('et5a-owner-a'), addUser('et5a-manager-a'), addUser('et5a-employee-a'), addUser('et5a-owner-b'),
    ])
    const session = await getAdminSession()
    appAdmin = session.client
    temporaryAdminUserId = session.temporaryAdminUserId
    const companies = await admin.from('companies').insert([
      { name: 'rls-test-et5a-empresa-a' }, { name: 'rls-test-et5a-empresa-b' },
    ]).select('id,name')
    requireSuccess(companies.error, 'empresas')
    companyA = companies.data?.find((row) => row.name === 'rls-test-et5a-empresa-a')?.id ?? ''
    companyB = companies.data?.find((row) => row.name === 'rls-test-et5a-empresa-b')?.id ?? ''
    if (!companyA || !companyB) throw new Error('Empresas Etapa 5A não retornadas')
    const codes = await admin.from('company_codes').insert([
      { company_id: companyA, code: randomTestCode('E5A'), version: 1, active: true, created_by: session.userId },
      { company_id: companyB, code: randomTestCode('E5B'), version: 1, active: true, created_by: session.userId },
    ]).select('id,company_id')
    requireSuccess(codes.error, 'códigos')
    const codeA = codes.data?.find((row) => row.company_id === companyA)?.id
    if (!codeA) throw new Error('Código Etapa 5A não retornado')
    const memberships = await admin.from('memberships').insert([
      { company_id: companyA, user_id: ids.get('et5a-owner-a'), role: 'owner', active: true },
      { company_id: companyA, user_id: ids.get('et5a-manager-a'), role: 'manager', active: true },
      { company_id: companyA, user_id: ids.get('et5a-employee-a'), role: 'employee', active: true, code_id: codeA },
      { company_id: companyB, user_id: ids.get('et5a-owner-b'), role: 'owner', active: true },
    ])
    requireSuccess(memberships.error, 'vínculos')
    const environments = await admin.from('environments').insert([
      { company_id: companyA, name: 'rls-test-et5a-a', active: true },
      { company_id: companyA, name: 'rls-test-et5a-c', active: true },
      { company_id: companyB, name: 'rls-test-et5a-b', active: true },
    ]).select('id,name')
    requireSuccess(environments.error, 'ambientes')
    environmentA = environments.data?.find((row) => row.name === 'rls-test-et5a-a')?.id ?? ''
    environmentC = environments.data?.find((row) => row.name === 'rls-test-et5a-c')?.id ?? ''
    const products = await admin.from('products').insert([
      { company_id: companyA, name: 'rls-test-et5a-produto-a', sku: 'e5a-a', unit: 'un', min_stock: 1, volume_ml: 570, dose_ml: 30, active: true },
      { company_id: companyB, name: 'rls-test-et5a-produto-b', sku: 'e5b-b', unit: 'un', min_stock: 1, active: true },
    ]).select('id,name')
    requireSuccess(products.error, 'produtos')
    productA = products.data?.find((row) => row.name === 'rls-test-et5a-produto-a')?.id ?? ''
    const baseCost = await admin.from('product_costs').insert({
      product_id: productA, company_id: companyA, unit_cost: 4,
    })
    requireSuccess(baseCost.error, 'custo base')
    const environmentPricing = await admin.from('product_environment_pricing').insert({
      product_id: productA, company_id: companyA, environment_id: environmentA,
      unit_price: 10, dose_price: 2,
    })
    requireSuccess(environmentPricing.error, 'preços do ambiente')
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

  it('anon não executa RPCs novas', async () => {
    if (!anon) throw new Error('Cliente anônimo ausente')
    const session = await anon.auth.getSession()
    expect(session.data.session).toBeNull()
    for (const name of ['get_stock_level_suggestions','list_sales_product_map','import_sales_batch','undo_sales_import','list_sales_imports','get_inventory_valuation','register_movement_idempotent','register_transfer_idempotent']) {
      const args = name === 'undo_sales_import' ? { p_batch_id: '00000000-0000-0000-0000-000000000000' } : { p_company_id: companyA }
      expect((await anon.rpc(name, args)).error, `anon executou ${name}`).not.toBeNull()
    }
    expect((await anon.rpc('list_product_environment_pricing', {
      p_company_id: companyA, p_environment_id: environmentA,
    })).error).not.toBeNull()
    expect((await anon.rpc('upsert_product_environment_pricing', {
      p_company_id: companyA, p_environment_id: environmentA, p_product_id: productA,
      p_unit_cost: 2, p_unit_price: 10, p_dose_price: 2,
    })).error).not.toBeNull()
  })

  it('funcionário não importa nem lê mapa', async () => {
    const employee = client('et5a-employee-a')
    expect((await employee.rpc('list_sales_product_map', { p_company_id: companyA })).error).not.toBeNull()
    expect((await employee.rpc('get_stock_level_suggestions', { p_company_id: companyA })).error).not.toBeNull()
    expect((await employee.rpc('get_inventory_valuation', { p_company_id: companyA })).error).not.toBeNull()
    expect((await employee.rpc('list_product_environment_pricing', {
      p_company_id: companyA, p_environment_id: environmentA,
    })).error).not.toBeNull()
    expect((await employee.rpc('upsert_product_environment_pricing', {
      p_company_id: companyA, p_environment_id: environmentA, p_product_id: productA,
      p_unit_cost: 2, p_unit_price: 10, p_dose_price: 2,
    })).error).not.toBeNull()
  })

  it('gerente não importa venda sem saldo e importa depois de repor estoque', async () => {
    const manager = client('et5a-manager-a')
    const pricing = await manager.rpc('list_product_environment_pricing', {
      p_company_id: companyA, p_environment_id: environmentA,
    })
    expect(pricing.error).toBeNull()
    expect(pricing.data?.[0]).toEqual(expect.objectContaining({ base_unit_cost: 4, unit_price: 10, dose_price: 2 }))
    const map = await manager.rpc('save_sales_product_map', {
      p_company_id: companyA, p_external_name: 'Produto Externo', p_product_id: productA, p_environment_id: environmentA,
    })
    expect(map.error).toBeNull()
    const rejected = await manager.rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'Evento teste',
      p_items: [{ product_id: productA, quantity: 2, sale_type: 'unidade' }],
    })
    expect(rejected.error?.message).toContain('Saldo insuficiente')
    expect((await manager.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 2,
    })).error).toBeNull()
    const batch = await manager.rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'Evento teste',
      p_items: [{ product_id: productA, quantity: 2, sale_type: 'unidade' }],
    })
    expect(batch.error).toBeNull()
    const history = await manager.rpc('list_sales_imports', { p_company_id: companyA })
    expect(history.error).toBeNull()
    expect((history.data ?? []).find((row: { batch_id: string }) => row.batch_id === batch.data)).toEqual(expect.objectContaining({
      total_revenue: 20,
      total_cogs: 8,
      total_gross_profit: 12,
    }))
    const items = await manager.from('sales_import_items')
      .select('sale_price_snapshot,unit_cost_snapshot,revenue,cost_of_goods_sold')
      .eq('batch_id', batch.data)
    expect(items.error).toBeNull()
    expect(items.data?.[0]).toEqual(expect.objectContaining({
      sale_price_snapshot: 10,
      unit_cost_snapshot: 4,
      revenue: 20,
      cost_of_goods_sold: 8,
    }))
  })

  it('venda por dose abate fração conforme volume e dose', async () => {
    const manager = client('et5a-manager-a')
    await admin.from('products').update({ volume_ml: 570, dose_ml: 30 }).eq('id', productA)
    await manager.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 2,
    })
    const batch = await manager.rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'Dose teste',
      p_items: [{ product_id: productA, quantity: 19, sale_type: 'dose' }],
    })
    expect(batch.error).toBeNull()
    const balance = await manager.rpc('get_stock_balance', {
      p_company_id: companyA, p_environment_id: environmentA,
    })
    expect(balance.error).toBeNull()
    const row = (balance.data ?? []).find((item: { product_id: string }) => item.product_id === productA)
    expect(row).toEqual(expect.objectContaining({ balance: 1 }))
  })

  it('undo duas vezes falha e estorna o lote', async () => {
    const owner = client('et5a-owner-a')
    expect((await owner.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 1,
    })).error).toBeNull()
    const batch = await owner.rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'Undo teste',
      p_items: [{ product_id: productA, quantity: 1, sale_type: 'unidade' }],
    })
    expect(batch.error).toBeNull()
    expect((await owner.rpc('undo_sales_import', { p_batch_id: batch.data })).error).toBeNull()
    expect((await owner.rpc('undo_sales_import', { p_batch_id: batch.data })).error).not.toBeNull()
  })

  it('empresa B não vê mapas nem vendas da empresa A', async () => {
    const ownerB = client('et5a-owner-b')
    const map = await ownerB.rpc('list_sales_product_map', { p_company_id: companyA })
    expect(map.error).not.toBeNull()
  })

  it('admin lê histórico e pode importar como suporte', async () => {
    if (!appAdmin) throw new Error('Admin Etapa 5A ausente')
    expect((await appAdmin.rpc('list_sales_imports', { p_company_id: companyA })).error).toBeNull()
    expect((await appAdmin.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 1,
    })).error).toBeNull()
    expect((await appAdmin.rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'Admin',
      p_items: [{ product_id: productA, quantity: 1, sale_type: 'unidade' }],
    })).error).toBeNull()
  })

  it('client_request_id repetido não duplica movimentação', async () => {
    const owner = client('et5a-owner-a')
    const request = '11111111-1111-4111-8111-111111111111'
    const first = await owner.rpc('register_movement_idempotent', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 1, p_client_request_id: request,
    })
    expect(first.error).toBeNull()
    const second = await owner.rpc('register_movement_idempotent', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 1, p_client_request_id: request,
    })
    expect(second.error).toBeNull()
    expect(second.data).toBe(first.data)
  })

  it('RPCs originais de movimento e transferência continuam funcionando', async () => {
    const owner = client('et5a-owner-a')
    const movement = await owner.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 5,
    })
    expect(movement.error).toBeNull()
    const origin = await owner.rpc('get_stock_balance', {
      p_company_id: companyA, p_environment_id: environmentA,
    })
    expect(origin.error).toBeNull()
    const originRow = (origin.data ?? []).find((row: { product_id: string }) => row.product_id === productA)
    expect(Number(originRow?.balance)).toBeGreaterThanOrEqual(1)
    const transfer = await owner.rpc('register_transfer', {
      p_company_id: companyA,
      p_product_id: productA,
      p_from_environment_id: environmentA,
      p_to_environment_id: environmentC,
      p_quantity: 1,
    })
    expect(transfer.error).toBeNull()
  })

  it('transferência idempotente não duplica as duas pernas', async () => {
    const owner = client('et5a-owner-a')
    await owner.rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 5,
    })
    const request = '22222222-2222-4222-8222-222222222222'
    const first = await owner.rpc('register_transfer_idempotent', {
      p_company_id: companyA,
      p_product_id: productA,
      p_from_environment_id: environmentA,
      p_to_environment_id: environmentC,
      p_quantity: 1,
      p_client_request_id: request,
    })
    expect(first.error).toBeNull()
    const second = await owner.rpc('register_transfer_idempotent', {
      p_company_id: companyA,
      p_product_id: productA,
      p_from_environment_id: environmentA,
      p_to_environment_id: environmentC,
      p_quantity: 1,
      p_client_request_id: request,
    })
    expect(second.error).toBeNull()
    expect(second.data).toBe(first.data)
  })

  it('movimento idempotente aceita chamada sem p_note', async () => {
    const owner = client('et5a-owner-a')
    const request = '33333333-3333-4333-8333-333333333333'
    const result = await owner.rpc('register_movement_idempotent', {
      p_company_id: companyA,
      p_product_id: productA,
      p_environment_id: environmentA,
      p_type: 'entrada',
      p_quantity: 1,
      p_client_request_id: request,
    })
    expect(result.error).toBeNull()
  })
})
