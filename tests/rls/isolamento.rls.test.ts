import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  adminClient, anonClient, createTestUser, getAdminSession, loggedClient, loginUser,
  randomEmail, randomTestCode, rlsConfig, testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

suite('RLS isolamento entre empresas', () => {
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
  let reasonId = ''
  let lossMovementA = ''
  let batchA = ''
  let mapId = ''
  let temporaryAdminUserId: string | null = null

  function client(name: string): SupabaseClient {
    const value = clients.get(name)
    if (!value) throw new Error(`Cliente isolamento não encontrado: ${name}`)
    return value
  }
  function id(name: string): string {
    const value = ids.get(name)
    if (!value) throw new Error(`ID isolamento não encontrado: ${name}`)
    return value
  }
  function requireSuccess(error: { message: string } | null, operation: string) {
    if (error) throw new Error(`Falha setup isolamento (${operation}): ${error.message}`)
  }
  async function addUser(name: string) {
    if (!admin) throw new Error('Admin isolamento ausente')
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
      addUser('iso-owner-a'),
      addUser('iso-owner-b'),
      addUser('iso-employee-a'),
      addUser('iso-no-membership'),
    ])
    const session = await getAdminSession()
    temporaryAdminUserId = session.temporaryAdminUserId
    const companies = await admin.from('companies').insert([
      { name: 'rls-test-iso-empresa-a' },
      { name: 'rls-test-iso-empresa-b' },
    ]).select('id,name')
    requireSuccess(companies.error, 'empresas')
    companyA = companies.data?.find((row) => row.name === 'rls-test-iso-empresa-a')?.id ?? ''
    companyB = companies.data?.find((row) => row.name === 'rls-test-iso-empresa-b')?.id ?? ''
    const codes = await admin.from('company_codes').insert([
      { company_id: companyA, code: randomTestCode('ISOA'), version: 1, active: true, created_by: session.userId },
      { company_id: companyB, code: randomTestCode('ISOB'), version: 1, active: true, created_by: session.userId },
    ]).select('id,company_id')
    requireSuccess(codes.error, 'códigos')
    const codeA = codes.data?.find((row) => row.company_id === companyA)?.id
    if (!codeA) throw new Error('Código isolamento A ausente')
    const memberships = await admin.from('memberships').insert([
      { company_id: companyA, user_id: id('iso-owner-a'), role: 'owner', active: true },
      { company_id: companyB, user_id: id('iso-owner-b'), role: 'owner', active: true },
      { company_id: companyA, user_id: id('iso-employee-a'), role: 'employee', active: true, code_id: codeA },
    ])
    requireSuccess(memberships.error, 'vínculos')
    const environments = await admin.from('environments').insert([
      { company_id: companyA, name: 'iso-a', active: true },
      { company_id: companyB, name: 'iso-b', active: true },
    ]).select('id,name')
    requireSuccess(environments.error, 'ambientes')
    environmentA = environments.data?.find((row) => row.name === 'iso-a')?.id ?? ''
    environmentB = environments.data?.find((row) => row.name === 'iso-b')?.id ?? ''
    const products = await admin.from('products').insert([
      { company_id: companyA, name: 'iso-produto-a', unit: 'un', min_stock: 1, volume_ml: 998, dose_ml: 50, active: true },
      { company_id: companyB, name: 'iso-produto-b', unit: 'un', min_stock: 1, volume_ml: 998, dose_ml: 50, active: true },
    ]).select('id,name')
    requireSuccess(products.error, 'produtos')
    productA = products.data?.find((row) => row.name === 'iso-produto-a')?.id ?? ''
    const pricing = await admin.from('product_environment_pricing').insert({
      product_id: productA, company_id: companyA, environment_id: environmentA,
      unit_price: 10,
    })
    requireSuccess(pricing.error, 'preço de venda A')
    const entry = await client('iso-owner-a').rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 5,
    })
    requireSuccess(entry.error, 'entrada A')
    const lossReason = await admin.from('loss_reasons').insert({
      company_id: companyA, name: 'Quebra', active: true,
    }).select('id').single()
    requireSuccess(lossReason.error, 'motivo')
    reasonId = lossReason.data?.id ?? ''
    const loss = await client('iso-owner-a').rpc('register_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'perda', p_quantity: 1,
    })
    requireSuccess(loss.error, 'perda A')
    lossMovementA = loss.data
    const batch = await client('iso-owner-a').rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'Lote A',
      p_items: [{ product_id: productA, quantity: 1, sale_type: 'unidade' }],
    })
    requireSuccess(batch.error, 'lote A')
    batchA = batch.data
    const map = await client('iso-owner-a').rpc('save_sales_product_map', {
      p_company_id: companyA,
      p_external_name: 'Vodka Original',
      p_product_id: productA,
      p_environment_id: environmentA,
    })
    requireSuccess(map.error, 'mapa A')
    mapId = map.data
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

  it('anon não executa escrita nova', async () => {
    if (!anon) throw new Error('Anon ausente')
    expect((await anon.rpc('zero_stock', { p_company_id: companyA, p_environment_id: environmentA, p_reason: 'ataque' })).error).not.toBeNull()
  })

  it('dono B não zera empresa A nem mistura ids', async () => {
    const ownerB = client('iso-owner-b')
    expect((await ownerB.rpc('zero_stock', { p_company_id: companyA, p_environment_id: environmentA, p_product_id: productA, p_reason: 'ataque' })).error).not.toBeNull()
    expect((await ownerB.rpc('zero_stock', { p_company_id: companyB, p_environment_id: environmentA, p_product_id: productA, p_reason: 'ataque' })).error).not.toBeNull()
  })

  it('dose, venda e lote não cruzam empresas', async () => {
    const ownerB = client('iso-owner-b')
    expect((await ownerB.rpc('register_dose_movement', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_kind: 'entrada', p_doses: 19,
    })).error).not.toBeNull()
    expect((await ownerB.rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'ataque',
      p_items: [{ product_id: productA, quantity: 1, sale_type: 'unidade' }],
    })).error).not.toBeNull()
    expect((await ownerB.rpc('undo_sales_import', { p_batch_id: batchA })).error).not.toBeNull()
  })

  it('mapa, motivo e estorno não cruzam empresas', async () => {
    const ownerB = client('iso-owner-b')
    expect((await ownerB.rpc('save_sales_product_map', {
      p_company_id: companyA, p_external_name: 'Ataque', p_product_id: productA, p_environment_id: environmentA,
    })).error).not.toBeNull()
    expect((await ownerB.rpc('complete_pending_loss_reason', {
      p_movement_id: lossMovementA, p_reason_id: reasonId,
    })).error).not.toBeNull()
    expect((await ownerB.rpc('reverse_movement', { p_movement_id: lossMovementA })).error).not.toBeNull()
  })

  it('wrappers idempotentes não cruzam empresas', async () => {
    const ownerB = client('iso-owner-b')
    expect((await ownerB.rpc('register_movement_idempotent', {
      p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA,
      p_type: 'entrada', p_quantity: 1, p_client_request_id: '44444444-4444-4444-8444-444444444444',
    })).error).not.toBeNull()
    expect((await ownerB.rpc('register_transfer_idempotent', {
      p_company_id: companyB, p_product_id: productA, p_from_environment_id: environmentA,
      p_to_environment_id: environmentB, p_quantity: 1,
      p_client_request_id: '55555555-5555-4555-8555-555555555555',
    })).error).not.toBeNull()
  })

  it('inventário não cruza empresa', async () => {
    const ownerB = client('iso-owner-b')
    expect((await ownerB.rpc('open_inventory_session', { p_company_id: companyA, p_environment_id: environmentA })).error).not.toBeNull()
  })

  it('usuário sem vínculo não executa zero_stock', async () => {
    expect((await client('iso-no-membership').rpc('zero_stock', {
      p_company_id: companyA, p_environment_id: environmentA, p_reason: 'ataque',
    })).error).not.toBeNull()
  })

  it('usuário sem vínculo não importa vendas', async () => {
    expect((await client('iso-no-membership').rpc('import_sales_batch', {
      p_company_id: companyA, p_environment_id: environmentA, p_label: 'ataque',
      p_items: [{ product_id: productA, quantity: 1, sale_type: 'unidade' }],
    })).error).not.toBeNull()
  })

  it('usuário sem vínculo não salva mapa', async () => {
    expect((await client('iso-no-membership').rpc('save_sales_product_map', {
      p_company_id: companyA, p_external_name: 'Ataque', p_product_id: productA, p_environment_id: environmentA,
    })).error).not.toBeNull()
  })

  it('usuário sem vínculo não lê compras nem alertas', async () => {
    const attacker = client('iso-no-membership')
    expect((await attacker.rpc('get_purchase_list', { p_company_id: companyA })).error).not.toBeNull()
    expect((await attacker.rpc('get_low_stock_alerts', { p_company_id: companyA })).error).not.toBeNull()
    expect((await attacker.rpc('get_team_members', { p_company_id: companyA })).error).not.toBeNull()
  })

  it.each(['iso-owner-b', 'iso-no-membership'])(
    '%s não desfaz o lote real da empresa A',
    async (attackerName) => {
      const before = await client('iso-owner-a').rpc('list_sales_imports', { p_company_id: companyA })
      expect(before.error).toBeNull()
      const beforeBatch = (before.data ?? []).find((row: { batch_id: string }) => row.batch_id === batchA)
      expect(beforeBatch?.status).toBe('applied')

      const attack = await client(attackerName).rpc('undo_sales_import', { p_batch_id: batchA })
      expect(attack.error).not.toBeNull()

      const after = await client('iso-owner-a').rpc('list_sales_imports', { p_company_id: companyA })
      expect(after.error).toBeNull()
      const afterBatch = (after.data ?? []).find((row: { batch_id: string }) => row.batch_id === batchA)
      expect(afterBatch?.status).toBe('applied')
    },
  )

  it.each(['iso-owner-b', 'iso-no-membership'])(
    '%s não remove o mapa real da empresa A',
    async (attackerName) => {
      const attack = await client(attackerName).rpc('remove_sales_product_map', {
        p_company_id: companyA,
        p_map_id: mapId,
      })
      expect(attack.error).not.toBeNull()

      const intact = await client('iso-owner-a').rpc('list_sales_product_map', { p_company_id: companyA })
      expect(intact.error).toBeNull()
      expect((intact.data ?? []).some((row: { map_id: string }) => row.map_id === mapId)).toBe(true)
    },
  )

  it.each(['iso-owner-b', 'iso-no-membership'])(
    '%s não completa a perda real da empresa A',
    async (attackerName) => {
      const attack = await client(attackerName).rpc('complete_pending_loss_reason', {
        p_movement_id: lossMovementA,
        p_reason_id: reasonId,
      })
      expect(attack.error).not.toBeNull()

      const intact = await client('iso-owner-a').rpc('get_pending_loss_reasons', { p_company_id: companyA })
      expect(intact.error).toBeNull()
      expect((intact.data ?? []).some((row: { movement_id: string }) => row.movement_id === lossMovementA)).toBe(true)
    },
  )

  it.each(['iso-owner-b', 'iso-no-membership'])(
    '%s não estorna a movimentação real da empresa A',
    async (attackerName) => {
      const attack = await client(attackerName).rpc('reverse_movement', { p_movement_id: lossMovementA })
      expect(attack.error).not.toBeNull()

      const intact = await client('iso-owner-a')
        .from('stock_movements')
        .select('id,reverses_movement_id')
        .eq('id', lossMovementA)
        .maybeSingle()
      expect(intact.error).toBeNull()
      expect(intact.data?.id).toBe(lossMovementA)
      expect(intact.data?.reverses_movement_id).toBeNull()
    },
  )

  it.each(['iso-owner-b', 'iso-no-membership'])(
    '%s não importa venda na empresa A',
    async (attackerName) => {
      const before = await client('iso-owner-a').rpc('list_sales_imports', { p_company_id: companyA })
      expect(before.error).toBeNull()
      const batchCountBefore = (before.data ?? []).length

      const attack = await client(attackerName).rpc('import_sales_batch', {
        p_company_id: companyA,
        p_environment_id: environmentA,
        p_label: 'ataque',
        p_items: [{ product_id: productA, quantity: 1, sale_type: 'unidade' }],
      })
      expect(attack.error).not.toBeNull()

      const after = await client('iso-owner-a').rpc('list_sales_imports', { p_company_id: companyA })
      expect(after.error).toBeNull()
      expect((after.data ?? []).length).toBe(batchCountBefore)
    },
  )

  it.each(['iso-owner-b', 'iso-no-membership'])(
    '%s não cria mapa na empresa A',
    async (attackerName) => {
      const before = await client('iso-owner-a').rpc('list_sales_product_map', { p_company_id: companyA })
      expect(before.error).toBeNull()
      const mapCountBefore = (before.data ?? []).length

      const attack = await client(attackerName).rpc('save_sales_product_map', {
        p_company_id: companyA,
        p_external_name: 'Ataque novo',
        p_product_id: productA,
        p_environment_id: environmentA,
      })
      expect(attack.error).not.toBeNull()

      const after = await client('iso-owner-a').rpc('list_sales_product_map', { p_company_id: companyA })
      expect(after.error).toBeNull()
      expect((after.data ?? []).length).toBe(mapCountBefore)
    },
  )
})
