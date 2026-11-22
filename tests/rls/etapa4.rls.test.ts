import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  adminClient, anonClient, createTestUser, getAdminSession, loggedClient, loginUser,
  randomEmail, randomTestCode, rlsConfig, testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip
const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

suite('RLS Etapa 4 - gestão', () => {
  const admin = rlsConfig ? adminClient() : null
  const anon = rlsConfig ? anonClient() : null
  const users: User[] = []
  const clients = new Map<string, SupabaseClient>()
  const ids = new Map<string, string>()
  let companyA = ''
  let companyB = ''
  let envA = ''
  let envEmpty = ''
  let envB = ''
  let code = ''
  let temporaryAdminUserId: string | null = null
  let appAdmin: SupabaseClient | null = null

  function client(name: string): SupabaseClient {
    const result = clients.get(name)
    if (!result) throw new Error(`Cliente não encontrado no setup Etapa 4: ${name}`)
    return result
  }

  function id(name: string): string {
    const result = ids.get(name)
    if (!result) throw new Error(`ID não encontrado no setup Etapa 4: ${name}`)
    return result
  }

  async function addUser(name: string) {
    if (!admin) throw new Error('Cliente de serviço ausente')
    const email = randomEmail(`rls-test-${name}`)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    const session = await loginUser(email, password)
    clients.set(name, loggedClient(session.access_token))
    ids.set(name, user.id)
  }

  function requireSuccess(error: { message: string } | null, operation: string) {
    if (error) throw new Error(`Falha no setup Etapa 4 (${operation}): ${error.message}`)
  }

  function rpcArgs(companyId: string) {
    return [
      ['get_product_stock_limits', { p_company_id: companyId }],
      ['get_low_stock_alerts', { p_company_id: companyId }],
      ['get_negative_balances', { p_company_id: companyId }],
      ['get_environment_low_stock', { p_company_id: companyId }],
      ['get_movement_report', { p_company_id: companyId, p_from: from, p_to: to }],
      ['get_audit_log', { p_company_id: companyId, p_from: from, p_to: to }],
    ] as const
  }

  beforeAll(async () => {
    if (!admin) return
    await Promise.all(['et4-owner-a', 'et4-manager-a', 'et4-employee-a', 'et4-owner-b'].map(addUser))
    const adminSession = await getAdminSession()
    appAdmin = adminSession.client
    temporaryAdminUserId = adminSession.temporaryAdminUserId

    const companies = await admin.from('companies').insert([
      { name: 'rls-test-et4-empresa-a' }, { name: 'rls-test-et4-empresa-b' },
    ]).select('id,name')
    requireSuccess(companies.error, 'empresas')
    companyA = companies.data?.find((row) => row.name === 'rls-test-et4-empresa-a')?.id ?? ''
    companyB = companies.data?.find((row) => row.name === 'rls-test-et4-empresa-b')?.id ?? ''
    if (!companyA || !companyB) throw new Error('Empresas da Etapa 4 não retornadas')

    code = randomTestCode('ET4A')
    const codeResult = await admin.from('company_codes').insert({
      company_id: companyA, code, version: 1, active: true, created_by: id('et4-owner-a'),
    }).select('id').single()
    requireSuccess(codeResult.error, 'código')
    if (!codeResult.data?.id) throw new Error('Código da Etapa 4 não retornado')
    const membership = await admin.from('memberships').insert([
      { company_id: companyA, user_id: id('et4-owner-a'), role: 'owner', active: true },
      { company_id: companyA, user_id: id('et4-manager-a'), role: 'manager', active: true },
      { company_id: companyA, user_id: id('et4-employee-a'), role: 'employee', active: true, code_id: codeResult.data.id },
      { company_id: companyB, user_id: id('et4-owner-b'), role: 'owner', active: true },
    ])
    requireSuccess(membership.error, 'vínculos')

    const environments = await admin.from('environments').insert([
      { company_id: companyA, name: 'rls-test-et4-ambiente-a', active: true },
      { company_id: companyA, name: 'rls-test-et4-ambiente-vazio', active: true },
      { company_id: companyB, name: 'rls-test-et4-ambiente-b', active: true },
    ]).select('id,name')
    requireSuccess(environments.error, 'ambientes')
    envA = environments.data?.find((row) => row.name === 'rls-test-et4-ambiente-a')?.id ?? ''
    envEmpty = environments.data?.find((row) => row.name === 'rls-test-et4-ambiente-vazio')?.id ?? ''
    envB = environments.data?.find((row) => row.name === 'rls-test-et4-ambiente-b')?.id ?? ''
    if (!envA || !envEmpty || !envB) throw new Error('Ambientes da Etapa 4 não retornados')

    const products = await admin.from('products').insert([
      { company_id: companyA, name: 'rls-test-et4-com-maximo', sku: 'et4-com-maximo', unit: 'un', min_stock: 9, max_stock: 20, active: true },
      { company_id: companyA, name: 'rls-test-et4-sem-maximo', sku: 'et4-sem-maximo', unit: 'un', min_stock: 5, max_stock: null, active: true },
      { company_id: companyA, name: 'rls-test-et4-sem-minimo', sku: 'et4-sem-minimo', unit: 'un', min_stock: null, max_stock: null, active: true },
      { company_id: companyA, name: 'rls-test-et4-inativo', sku: 'et4-inativo', unit: 'un', min_stock: 5, max_stock: null, active: false },
      { company_id: companyB, name: 'rls-test-et4-empresa-b', sku: 'et4-empresa-b', unit: 'un', min_stock: 5, max_stock: null, active: true },
    ]).select('id,name')
    requireSuccess(products.error, 'produtos')
    for (const row of products.data ?? []) ids.set(row.name, row.id)
    for (const name of ['com-maximo', 'sem-maximo', 'sem-minimo', 'inativo', 'empresa-b']) id(`rls-test-et4-${name}`)

    const cost = await admin.from('product_costs').insert({
      company_id: companyA, product_id: id('rls-test-et4-com-maximo'), unit_cost: 2,
    })
    requireSuccess(cost.error, 'custo')

    const ownerA = client('et4-owner-a')
    const ownerB = client('et4-owner-b')
    const entries = [
      ['rls-test-et4-com-maximo', 3],
      ['rls-test-et4-sem-maximo', 2],
    ] as const
    for (const [productName, quantity] of entries) {
      const entry = await ownerA.rpc('register_movement', {
        p_company_id: companyA,
        p_product_id: id(productName),
        p_environment_id: envA,
        p_type: 'entrada',
        p_quantity: quantity,
      })
      requireSuccess(entry.error, `entrada ${productName}`)
    }

    const negativeEntry = await ownerA.rpc('register_movement', {
      p_company_id: companyA,
      p_product_id: id('rls-test-et4-sem-minimo'),
      p_environment_id: envA,
      p_type: 'entrada',
      p_quantity: 4,
    })
    requireSuccess(negativeEntry.error, 'entrada inicial para saldo negativo')
    if (!negativeEntry.data) throw new Error('Entrada inicial para saldo negativo não retornada')

    const negativeExit = await ownerA.rpc('register_movement', {
      p_company_id: companyA,
      p_product_id: id('rls-test-et4-sem-minimo'),
      p_environment_id: envA,
      p_type: 'saida',
      p_quantity: 2,
    })
    requireSuccess(negativeExit.error, 'saída antes do estorno negativo')

    const negativeReversal = await ownerA.rpc('reverse_movement', {
      p_movement_id: negativeEntry.data,
      p_note: 'rls-test-et4-saldo-negativo',
    })
    requireSuccess(negativeReversal.error, 'estorno da entrada para saldo negativo')

    const negativeBalance = await ownerA.rpc('get_stock_balance', {
      p_company_id: companyA,
      p_environment_id: envA,
    })
    requireSuccess(negativeBalance.error, 'consulta do saldo negativo')
    const negativeProductBalance = (negativeBalance.data ?? []).find(
      (row: { product_id: string; balance: number }) => row.product_id === id('rls-test-et4-sem-minimo'),
    )
    if (Number(negativeProductBalance?.balance) !== -2) {
      throw new Error(`Saldo negativo não confirmado: esperado -2, recebido ${negativeProductBalance?.balance ?? 'nenhum'}`)
    }

    const companyBEntry = await ownerB.rpc('register_movement', {
      p_company_id: companyB,
      p_product_id: id('rls-test-et4-empresa-b'),
      p_environment_id: envB,
      p_type: 'entrada',
      p_quantity: 1,
    })
    requireSuccess(companyBEntry.error, 'entrada empresa B')

    const change = await client('et4-manager-a').from('products')
      .update({ min_stock: 10 }).eq('id', id('rls-test-et4-com-maximo'))
    requireSuccess(change.error, 'alteração de mínimo')
    const inventory = await client('et4-owner-a').rpc('open_inventory_session', {
      p_company_id: companyA, p_environment_id: envA,
    })
    requireSuccess(inventory.error, 'abertura de inventário')
    if (!inventory.data) throw new Error('Inventário não retornado')
    const finish = await client('et4-owner-a').rpc('finish_inventory_session', { p_session_id: inventory.data })
    requireSuccess(finish.error, 'fechamento de inventário')
  })

  afterAll(async () => {
    if (!admin) return
    // A tabela de movimentos é imutável mesmo para service_role; a remoção
    // de empresas com movimentos depende de manutenção privilegiada no banco de testes.
    if (temporaryAdminUserId) {
      const membership = await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      requireSuccess(membership.error, 'remoção do admin temporário')
      const removed = await admin.auth.admin.deleteUser(temporaryAdminUserId)
      requireSuccess(removed.error, 'remoção do usuário admin temporário')
    }
    if (companyA || companyB) {
      console.warn('Etapa 4: empresas, usuários e movimentações de teste permanecem no banco devido à imutabilidade de stock_movements.')
    } else {
      for (const user of users) {
        const removed = await admin.auth.admin.deleteUser(user.id)
        requireSuccess(removed.error, `remoção de usuário ${user.id}`)
      }
    }
  })

  it('anon realmente anônimo não executa nenhuma RPC nova', async () => {
    if (!anon) throw new Error('Cliente anônimo ausente')
    const session = await anon.auth.getSession()
    expect(session.data.session).toBeNull()
    for (const [name, args] of rpcArgs(companyA)) {
      const result = await anon.rpc(name, args)
      expect(result.error, `anon executou ${name}`).not.toBeNull()
    }
  })

  it('funcionário não executa nenhuma RPC nova nem lê mínimo ou máximo', async () => {
    const employee = client('et4-employee-a')
    for (const [name, args] of rpcArgs(companyA)) {
      const result = await employee.rpc(name, args)
      expect(result.error, `funcionário executou ${name}`).not.toBeNull()
    }
    const products = await employee.from('products').select('id,name').eq('company_id', companyA)
    expect(products.error).toBeNull()
    expect(products.data?.length).toBeGreaterThan(0)
    for (const column of ['min_stock', 'max_stock']) {
      const result = await employee.from('products').select(column).eq('company_id', companyA)
      expect(result.error, `funcionário leu ${column}`).not.toBeNull()
    }
    const all = await employee.from('products').select('*').eq('company_id', companyA)
    expect(all.error).not.toBeNull()
  })

  it('empresa A não lê dados da empresa B pelas RPCs', async () => {
    for (const [name, args] of rpcArgs(companyB)) {
      const result = await client('et4-manager-a').rpc(name, args)
      expect(result.error, `${name} permitiu acesso à empresa B`).not.toBeNull()
    }
  })

  it('gerente, proprietário e admin executam todas as RPCs', async () => {
    if (!appAdmin) throw new Error('Admin da aplicação ausente')
    for (const actor of [client('et4-manager-a'), client('et4-owner-a'), appAdmin]) {
      for (const [name, args] of rpcArgs(companyA)) {
        const result = await actor.rpc(name, args)
        expect(result.error, `${name}: ${result.error?.message ?? ''}`).toBeNull()
      }
    }
  })

  it('calcula sugestão com e sem máximo e ignora inativos e produtos sem mínimo', async () => {
    const result = await client('et4-manager-a').rpc('get_low_stock_alerts', { p_company_id: companyA })
    expect(result.error).toBeNull()
    const rows = result.data ?? []
    const withMaximum = rows.find((row: { product_id: string }) => row.product_id === id('rls-test-et4-com-maximo'))
    const withoutMaximum = rows.find((row: { product_id: string }) => row.product_id === id('rls-test-et4-sem-maximo'))
    expect(Number(withMaximum?.total_balance)).toBe(3)
    expect(Number(withMaximum?.suggested_qty)).toBe(17)
    expect(Number(withMaximum?.estimated_cost)).toBe(34)
    expect(Number(withoutMaximum?.suggested_qty)).toBe(8)
    expect(withoutMaximum?.estimated_cost).toBeNull()
    expect(rows.some((row: { product_id: string }) => row.product_id === id('rls-test-et4-inativo'))).toBe(false)
    expect(rows.some((row: { product_id: string }) => row.product_id === id('rls-test-et4-sem-minimo'))).toBe(false)
  })

  it('detecta saldo negativo causado por estorno e informa saldos por ambiente', async () => {
    const negative = await client('et4-manager-a').rpc('get_negative_balances', { p_company_id: companyA })
    expect(negative.error).toBeNull()
    expect(negative.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: id('rls-test-et4-sem-minimo'), environment_id: envA, balance: -2 }),
    ]))
    const environments = await client('et4-manager-a').rpc('get_environment_low_stock', { p_company_id: companyA })
    expect(environments.error).toBeNull()
    expect(environments.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: id('rls-test-et4-com-maximo'), environment_id: envA, balance: 3, total_balance: 3, min_stock: 10 }),
      expect.objectContaining({ product_id: id('rls-test-et4-com-maximo'), environment_id: envEmpty, balance: 0, total_balance: 3 }),
    ]))
  })

  it('relatório filtra período e ambiente e recusa mais de 366 dias', async () => {
    const manager = client('et4-manager-a')
    const report = await manager.rpc('get_movement_report', { p_company_id: companyA, p_from: from, p_to: to, p_environment_id: envA })
    expect(report.error).toBeNull()
    expect(report.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: id('rls-test-et4-com-maximo'), environment_id: envA, entradas: 3 }),
      expect.objectContaining({ product_id: id('rls-test-et4-sem-minimo'), ajustes: 0, estornos: -4 }),
    ]))
    const empty = await manager.rpc('get_movement_report', {
      p_company_id: companyA, p_from: '2000-01-01T00:00:00Z', p_to: '2000-01-02T00:00:00Z',
    })
    expect(empty.error).toBeNull()
    expect(empty.data).toHaveLength(0)
    const otherEnvironment = await manager.rpc('get_movement_report', {
      p_company_id: companyA, p_from: from, p_to: to, p_environment_id: envEmpty,
    })
    expect(otherEnvironment.error).toBeNull()
    expect(otherEnvironment.data).toHaveLength(0)
    const maximumInterval = await manager.rpc('get_movement_report', {
      p_company_id: companyA, p_from: '2020-01-01T00:00:00Z', p_to: '2021-01-01T00:00:00Z',
    })
    expect(maximumInterval.error).toBeNull()
    const tooLong = await manager.rpc('get_movement_report', {
      p_company_id: companyA, p_from: '2020-01-01T00:00:00Z', p_to: '2021-01-02T00:00:00Z',
    })
    expect(tooLong.error?.message).toContain('366')
  })

  it('rejeita máximo menor que mínimo e valores negativos', async () => {
    const manager = client('et4-manager-a')
    for (const limits of [{ min_stock: -1 }, { max_stock: -1 }, { min_stock: 11, max_stock: 10 }]) {
      const result = await manager.from('products').update(limits).eq('id', id('rls-test-et4-com-maximo'))
      expect(result.error, JSON.stringify(limits)).not.toBeNull()
    }
  })

  it('importa máximo opcional e conserva o formato anterior', async () => {
    const result = await client('et4-manager-a').rpc('import_products', {
      p_company_id: companyA,
      p_rows: [
        { name: 'rls-test-et4-import-max', unit: 'un', min_stock: 3, max_stock: 8 },
        { name: 'rls-test-et4-import-old', unit: 'un' },
        { name: 'rls-test-et4-com-maximo', unit: 'un', min_stock: 10 },
        { name: 'rls-test-et4-import-invalid', unit: 'un', min_stock: 5, max_stock: 2 },
      ],
    })
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ created: 2, updated: 1, ignored: 1 })
    const limits = await client('et4-manager-a').rpc('get_product_stock_limits', { p_company_id: companyA })
    expect(limits.error).toBeNull()
    expect(limits.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ min_stock: 3, max_stock: 8 }),
      expect.objectContaining({ min_stock: 0, max_stock: null }),
      expect.objectContaining({ product_id: id('rls-test-et4-com-maximo'), min_stock: 10, max_stock: 20 }),
    ]))
  })

  it('registra estorno, fechamento e alteração do mínimo sem revelar código; auditoria é imutável', async () => {
    const manager = client('et4-manager-a')
    const result = await manager.rpc('get_audit_log', { p_company_id: companyA, p_from: from, p_to: to })
    expect(result.error).toBeNull()
    const actions = (result.data ?? []).map((row: { action: string }) => row.action)
    expect(actions).toContain('movement_reversed')
    expect(actions).toContain('inventory_finished')
    expect(actions).toContain('products_updated')
    expect(JSON.stringify(result.data)).not.toContain(code)
    const raw = await manager.from('audit_log').select('id,action,data').eq('company_id', companyA).eq('action', 'products_updated')
    expect(raw.error).toBeNull()
    const entry = raw.data?.find((row) => row.data?.old?.min_stock === 9 && row.data?.new?.min_stock === 10)
    expect(entry, 'auditoria não registrou a mudança de mínimo').toBeDefined()
    if (!entry) throw new Error('Registro de auditoria ausente')
    const update = await manager.from('audit_log').update({ action: 'alterado' }).eq('id', entry.id)
    const remove = await manager.from('audit_log').delete().eq('id', entry.id)
    expect(update.error).not.toBeNull()
    expect(remove.error).not.toBeNull()
    const stillThere = await manager.from('audit_log').select('id,action').eq('id', entry.id).single()
    expect(stillThere.error).toBeNull()
    expect(stillThere.data?.action).toBe('products_updated')
  })
})
