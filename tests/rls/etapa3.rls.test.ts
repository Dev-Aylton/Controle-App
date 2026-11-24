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
  testPassword,
  getAdminSession,
  randomTestCode,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip
if (!rlsConfig) console.info('RLS Etapa 3 ignorado: faltam variáveis em .env.test.')

suite('RLS Etapa 3 - movimentações e inventário', () => {
  const admin = rlsConfig ? adminClient() : null as unknown as ReturnType<typeof adminClient>
  const anon = rlsConfig ? anonClient() : null as unknown as ReturnType<typeof anonClient>
  const users: User[] = []
  let companyA = ''
  let companyB = ''
  let environmentA = ''
  let environmentB = ''
  let environmentOtherB = ''
  let productA = ''
  let productB = ''
  let batchProductA = ''
  let managerClient: ReturnType<typeof loggedClient> | null = null
  let employeeClient: ReturnType<typeof loggedClient> | null = null
  let temporaryAdminUserId: string | null = null
  let movementFromEmployee = ''
  const createdUsers = new Map<string, { id: string; email: string }>()
  const tokenByName = new Map<string, string>()

  async function addUser(name: string) {
    const email = randomEmail(name)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    const session = await loginUser(email, password)
    createdUsers.set(name, { id: user.id, email })
    tokenByName.set(name, session.access_token)
    return { user, client: loggedClient(session.access_token) }
  }

  beforeAll(async () => {
    if (!rlsConfig) return
    try {
      const [owner, manager, employee, employeeOld, ownerB] = await Promise.all([
        addUser('et3-owner-a'),
        addUser('et3-manager-a'),
        addUser('et3-employee-a'),
        addUser('et3-employee-old'),
        addUser('et3-owner-b'),
      ])
      managerClient = manager.client
      employeeClient = employee.client

      const adminSession = await getAdminSession()
      temporaryAdminUserId = adminSession.temporaryAdminUserId

      const companyAResult = await admin.from('companies').insert({ name: 'rls-test-et3-empresa-a' }).select('id').single()
      if (companyAResult.error || !companyAResult.data) throw new Error(`Falha empresa A Etapa 3: ${companyAResult.error?.message ?? ''}`)
      companyA = companyAResult.data.id
      const companyBResult = await admin.from('companies').insert({ name: 'rls-test-et3-empresa-b' }).select('id').single()
      if (companyBResult.error || !companyBResult.data) throw new Error(`Falha empresa B Etapa 3: ${companyBResult.error?.message ?? ''}`)
      companyB = companyBResult.data.id

      const environmentResult = await admin.from('environments').insert([
        { company_id: companyA, name: 'rls-test-et3-bar-a', active: true },
        { company_id: companyA, name: 'rls-test-et3-estoque-a', active: true },
        { company_id: companyB, name: 'rls-test-et3-bar-b', active: true },
      ]).select('*')
      if (environmentResult.error) throw new Error(`Falha ambientes Etapa 3: ${environmentResult.error.message}`)
      environmentA = environmentResult.data?.find((item) => item.company_id === companyA && item.name.includes('bar'))?.id ?? ''
      environmentB = environmentResult.data?.find((item) => item.company_id === companyA && item.name.includes('estoque'))?.id ?? ''
      environmentOtherB = environmentResult.data?.find((item) => item.company_id === companyB)?.id ?? ''

      const productResult = await admin.from('products').insert([
        { company_id: companyA, name: 'rls-test-et3-produto-a', sku: 'rls-test-et3-a', unit: 'un', active: true },
        { company_id: companyA, name: 'rls-test-et3-produto-lote', sku: 'rls-test-et3-lote', unit: 'un', active: true },
        { company_id: companyB, name: 'rls-test-et3-produto-b', sku: 'rls-test-et3-b', unit: 'un', active: true },
      ]).select('*')
      if (productResult.error) throw new Error(`Falha produtos Etapa 3: ${productResult.error.message}`)
      productA = productResult.data?.find((item) => item.company_id === companyA)?.id ?? ''
      productB = productResult.data?.find((item) => item.company_id === companyB)?.id ?? ''
      batchProductA = productResult.data?.find((item) => item.company_id === companyA && item.name.includes('lote'))?.id ?? ''
      if (!environmentA || !environmentB || !productA || !batchProductA || !productB) {
        throw new Error('Falha setup Etapa 3: ambientes ou produtos não foram criados.')
      }

      const codeResult = await admin.from('company_codes').insert([
        { company_id: companyA, code: randomTestCode('ET3A'), version: 1, active: true, created_by: adminSession.userId },
        { company_id: companyB, code: randomTestCode('ET3B'), version: 1, active: true, created_by: adminSession.userId },
      ]).select('*')
      if (codeResult.error || !codeResult.data) {
        throw new Error(`Falha códigos Etapa 3: ${codeResult.error?.message ?? 'dados não retornados'}${codeResult.error?.code ? ` [${codeResult.error.code}]` : ''}`)
      }
      const codeA = codeResult.data.find((code) => code.company_id === companyA)
      const codeB = codeResult.data.find((code) => code.company_id === companyB)
      if (!codeA || !codeB) throw new Error('Falha setup Etapa 3: código ativo não encontrado por empresa.')

      const membershipResult = await admin.from('memberships').insert([
        { user_id: owner.user.id, company_id: companyA, role: 'owner', active: true },
        { user_id: manager.user.id, company_id: companyA, role: 'manager', active: true },
        { user_id: employee.user.id, company_id: companyA, role: 'employee', active: true, code_id: codeA.id },
        { user_id: employeeOld.user.id, company_id: companyA, role: 'employee', active: true, code_id: codeA.id },
        { user_id: ownerB.user.id, company_id: companyB, role: 'owner', active: true, code_id: null },
      ])
      if (membershipResult.error) {
        throw new Error(`Falha memberships Etapa 3: ${membershipResult.error.message}${membershipResult.error.code ? ` [${membershipResult.error.code}]` : ''}`)
      }

      for (const name of ['et3-employee-a', 'et3-manager-a']) {
        const who = createdUsers.get(name)
        const token = tokenByName.get(name)
        const client = name === 'et3-employee-a' ? employeeClient : managerClient
        if (!who || !token || !client) {
          throw new Error(`Setup Etapa 3 incompleto para ${name}: who=${Boolean(who)} token=${Boolean(token)} client=${Boolean(client)}`)
        }
        const identity = await anonClient().auth.getUser(token)
        if (identity.data.user?.id !== who.id) throw new Error(`Token Etapa 3 não pertence ao usuário ${name}.`)
        const membership = await admin
          .from('memberships')
          .select('role,active,code_id')
          .eq('user_id', who.id)
          .eq('company_id', companyA)
          .maybeSingle()
        if (membership.error || !membership.data) {
          throw new Error(`Membership Etapa 3 não encontrada para ${name}: ${membership.error?.message ?? 'dados vazios'}`)
        }
        if (membership.data.active !== true) throw new Error(`Membership Etapa 3 inativa para ${name}.`)
      }
    } catch (caught) {
      if (companyA) await admin.from('companies').delete().eq('id', companyA)
      if (companyB) await admin.from('companies').delete().eq('id', companyB)
      if (temporaryAdminUserId) await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
      if (temporaryAdminUserId) await admin.auth.admin.deleteUser(temporaryAdminUserId)
      throw caught
    }
  })

  afterAll(async () => {
    if (!rlsConfig) return
    try {
      if (temporaryAdminUserId) await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      if (companyA) await admin.from('companies').delete().eq('id', companyA)
      if (companyB) await admin.from('companies').delete().eq('id', companyB)
    } finally {
      await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
      if (temporaryAdminUserId) await admin.auth.admin.deleteUser(temporaryAdminUserId)
    }
  })

  it('anon não lê movimentações nem executa RPCs', async () => {
    const { data: sess } = await anon.auth.getSession()
    expect(sess.session, 'cliente anon tem sessão ativa').toBeNull()
    const movements = await anon.from('stock_movements').select('*').limit(1)
    expect(Boolean(movements.error) || (movements.data ?? []).length === 0, 'anon leu movimentações').toBe(true)
    const rpc = await anon.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 1 })
    expect(rpc.error, 'anon executou register_movement').not.toBeNull()
  })

  it('empresa A não lê nem lança na empresa B', async () => {
    const managerResult = await managerClient!.from('stock_movements').select('*').eq('company_id', companyB)
    expect(managerResult.data ?? [], 'empresa A viu movimento da empresa B').toHaveLength(0)
    const result = await managerClient!.rpc('register_movement', { p_company_id: companyB, p_product_id: productB, p_environment_id: environmentB, p_type: 'entrada', p_quantity: 1 })
    expect(result.error, 'movimento foi lançado na empresa B').not.toBeNull()
  })

  it('funcionário lança entrada mas não lê saldo nem custo', async () => {
    const result = await employeeClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 5 })
    expect(result.error).toBeNull()
    movementFromEmployee = result.data as string
    const balance = await employeeClient!.rpc('get_stock_balance', { p_company_id: companyA, p_environment_id: environmentA })
    expect(balance.error, 'funcionário não conseguiu ler saldo').toBeNull()
    expect((balance.data ?? []).some((row) => row.product_id === productA)).toBe(true)
    const cost = await employeeClient!.from('product_costs').select('*').eq('company_id', companyA)
    expect(cost.data ?? [], 'funcionário leu custo').toHaveLength(0)
  })

  it('funcionário lê somente próprio lançamento recente', async () => {
    const result = await employeeClient!.from('stock_movements').select('*').eq('company_id', companyA)
    expect((result.data ?? []).every((movement) => movement.id === movementFromEmployee), 'funcionário viu movimento de outro usuário').toBe(true)
  })

  it('saída acima do saldo registra divergência auditada', async () => {
    const result = await employeeClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'saida', p_quantity: 999 })
    expect(result.error, 'saída com divergência deveria ser registrada').toBeNull()
    const divergence = await admin
      .from('audit_log')
      .select('action')
      .eq('company_id', companyA)
      .eq('action', 'stock_divergence_detected')
      .limit(1)
    expect(divergence.error).toBeNull()
    expect((divergence.data ?? []).length).toBeGreaterThan(0)
  })

  it('transferência cria duas pernas e estorno desfaz as duas', async () => {
    const seed = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 1100 })
    expect(seed.error).toBeNull()
    const transfer = await managerClient!.rpc('register_transfer', { p_company_id: companyA, p_product_id: productA, p_from_environment_id: environmentA, p_to_environment_id: environmentB, p_quantity: 1 })
    expect(transfer.error).toBeNull()
  })

  it('admin lança movimentação como suporte em empresa onde não é membro', async () => {
    const session = await getAdminSession()
    const result = await session.client.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 1 })
    expect(result.error, 'admin não lançou movimentação').toBeNull()
    const audit = await session.client
      .from('audit_log')
      .select('id,action,acted_as_support')
      .eq('company_id', companyA)
      .eq('action', 'movement_registered')
      .order('created_at', { ascending: false })
      .limit(1)
    expect(audit.error).toBeNull()
    expect(audit.data?.[0]?.acted_as_support).toBe(true)
    if (audit.data?.[0]) {
      const update = await session.client
        .from('audit_log')
        .update({ action: 'alterado' })
        .eq('id', audit.data[0].id)
      expect(update.error).not.toBeNull()
      const remove = await session.client
        .from('audit_log')
        .delete()
        .eq('id', audit.data[0].id)
      expect(remove.error).not.toBeNull()
    }
  })

  it('inventário cego permite contar e só gerente finaliza', async () => {
    const opened = await employeeClient!.rpc('open_inventory_session', { p_company_id: companyA, p_environment_id: environmentA })
    expect(opened.error).toBeNull()
    const counted = await employeeClient!.rpc('submit_inventory_count', { p_session_id: opened.data, p_product_id: productA, p_counted_quantity: 5 })
    expect(counted.error).toBeNull()
    const employeeFinish = await employeeClient!.rpc('finish_inventory_session', { p_session_id: opened.data })
    expect(employeeFinish.error, 'funcionário finalizou inventário').not.toBeNull()
  })

  it('funcionário estorna próprio lançamento dentro de 15 minutos', async () => {
    if (!movementFromEmployee) {
      const created = await employeeClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 2 })
      expect(created.error).toBeNull()
      movementFromEmployee = created.data as string
    }
    const reversed = await employeeClient!.rpc('reverse_movement', { p_movement_id: movementFromEmployee, p_note: 'rls-test-correção' })
    expect(reversed.error, 'funcionário não estornou próprio lançamento recente').toBeNull()
  })

  it('funcionário não estorna lançamento de outro usuário', async () => {
    const created = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 3 })
    expect(created.error).toBeNull()
    const reversed = await employeeClient!.rpc('reverse_movement', { p_movement_id: created.data, p_note: 'proibido' })
    expect(reversed.error, 'funcionário estornou movimento de outro usuário').not.toBeNull()
  })

  it('gerente estorna movimento de funcionário', async () => {
    const created = await employeeClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 2 })
    expect(created.error).toBeNull()
    const reversed = await managerClient!.rpc('reverse_movement', { p_movement_id: created.data, p_note: 'rls-test-gerente' })
    expect(reversed.error, 'gerente não estornou movimento').toBeNull()
  })

  it('estorno duplo e estorno de estorno falham', async () => {
    const created = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 2 })
    expect(created.error).toBeNull()
    const first = await managerClient!.rpc('reverse_movement', { p_movement_id: created.data, p_note: 'primeiro' })
    expect(first.error).toBeNull()
    const second = await managerClient!.rpc('reverse_movement', { p_movement_id: created.data, p_note: 'segundo' })
    expect(second.error, 'estorno duplo não falhou').not.toBeNull()
    const reverseEstorno = await managerClient!.rpc('reverse_movement', { p_movement_id: first.data, p_note: 'estorno do estorno' })
    expect(reverseEstorno.error, 'estorno de estorno não falhou').not.toBeNull()
  })

  it('transferência cria duas pernas e estorno estorna ambas', async () => {
    const seed = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 1100 })
    expect(seed.error).toBeNull()
    const transfer = await managerClient!.rpc('register_transfer', { p_company_id: companyA, p_product_id: productA, p_from_environment_id: environmentA, p_to_environment_id: environmentB, p_quantity: 1 })
    expect(transfer.error).toBeNull()
    const legs = await managerClient!.from('stock_movements').select('*').eq('transfer_group_id', transfer.data)
    expect((legs.data ?? []).filter((leg) => leg.type === 'transferencia_saida' || leg.type === 'transferencia_entrada').length, 'transferência não criou duas pernas').toBe(2)
    const leg = (legs.data ?? []).find((item) => item.type === 'transferencia_saida')
    const reversed = await managerClient!.rpc('reverse_movement', { p_movement_id: leg?.id, p_note: 'rls-test-transferência' })
    expect(reversed.error).toBeNull()
  })

  it('produto ou ambiente de outra empresa é rejeitado', async () => {
    const wrongProduct = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productB, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 1 })
    expect(wrongProduct.error, 'produto da empresa B foi aceito na empresa A').not.toBeNull()
    const wrongEnvironment = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentOtherB, p_type: 'entrada', p_quantity: 1 })
    expect(wrongEnvironment.error, 'ambiente da empresa B foi aceito na empresa A').not.toBeNull()
  })

  it('entrada em lote aceita funcionário ativo e valida produto, ambiente e duplicidade', async () => {
    const requestId = crypto.randomUUID()
    const args = {
      p_company_id: companyA,
      p_environment_id: environmentA,
      p_entries: [
        { product_id: productA, quantity: 2, note: 'lote teste 1' },
        { product_id: batchProductA, quantity: 3, note: 'lote teste 2' },
      ],
      p_client_request_id: requestId,
    }
    const before = await managerClient!.from('stock_movements')
      .select('id,product_id,quantity')
      .eq('company_id', companyA)
      .eq('environment_id', environmentA)
      .in('product_id', [productA, batchProductA])
    const batchResults = await Promise.all([
      employeeClient!.rpc('apply_movement_entry_batch', args),
      employeeClient!.rpc('apply_movement_entry_batch', args),
    ])
    const batch = batchResults[0]
    expect(batch.error, 'funcionário ativo não aplicou lote válido').toBeNull()
    expect((batch.data as { applied: number }).applied).toBe(2)
    expect(batchResults[1].error).toBeNull()
    expect(batchResults[1].data).toEqual(batch.data)
    const after = await managerClient!.from('stock_movements')
      .select('id,product_id,quantity')
      .eq('company_id', companyA)
      .eq('environment_id', environmentA)
      .in('product_id', [productA, batchProductA])
    expect((after.data ?? []).length).toBe((before.data ?? []).length + 2)

    const duplicate = await employeeClient!.rpc('apply_movement_entry_batch', {
      p_company_id: companyA,
      p_environment_id: environmentA,
      p_entries: [
        { product_id: productA, quantity: 1, note: null },
        { product_id: productA, quantity: 2, note: null },
      ],
      p_client_request_id: crypto.randomUUID(),
    })
    expect(duplicate.error?.message, 'produto duplicado no lote não falhou').toContain('duplicado')

    const wrongProduct = await employeeClient!.rpc('apply_movement_entry_batch', {
      p_company_id: companyA,
      p_environment_id: environmentA,
      p_entries: [{ product_id: productB, quantity: 1, note: null }],
      p_client_request_id: crypto.randomUUID(),
    })
    expect(wrongProduct.error, 'produto da empresa B foi aceito em lote').not.toBeNull()

    const wrongEnvironment = await employeeClient!.rpc('apply_movement_entry_batch', {
      p_company_id: companyA,
      p_environment_id: environmentOtherB,
      p_entries: [{ product_id: productA, quantity: 1, note: null }],
      p_client_request_id: crypto.randomUUID(),
    })
    expect(wrongEnvironment.error, 'ambiente da empresa B foi aceito em lote').not.toBeNull()
  })

  it('movimentação manual em lote aplica entradas, saídas e transferências válidas com idempotência', async () => {
    const seed = await employeeClient!.rpc('register_movement', {
      p_company_id: companyA,
      p_product_id: productA,
      p_environment_id: environmentA,
      p_type: 'entrada',
      p_quantity: 20,
    })
    expect(seed.error).toBeNull()

    const requestId = crypto.randomUUID()
    const entries = [
      { product_id: productA, environment_id: environmentA, type: 'saida', quantity: 2, note: 'saída lote manual' },
      { product_id: batchProductA, environment_id: environmentA, type: 'entrada', quantity: 3, note: 'entrada lote manual' },
      { product_id: productA, environment_id: environmentA, to_environment_id: environmentB, type: 'transferencia', quantity: 1, note: 'transferência lote manual' },
    ]
    const batchResults = await Promise.all([
      employeeClient!.rpc('apply_movement_batch', { p_company_id: companyA, p_entries: entries, p_client_request_id: requestId }),
      employeeClient!.rpc('apply_movement_batch', { p_company_id: companyA, p_entries: entries, p_client_request_id: requestId }),
    ])
    expect(batchResults[0].error).toBeNull()
    expect(batchResults[1].error).toBeNull()
    expect(batchResults[0].data).toEqual(batchResults[1].data)
    expect((batchResults[0].data as { applied: number }).applied).toBe(3)
  })

  it('movimentação manual em lote rejeita produto externo e transferência sem destino', async () => {
    const wrongProduct = await employeeClient!.rpc('apply_movement_batch', {
      p_company_id: companyA,
      p_entries: [{ product_id: productB, environment_id: environmentA, type: 'entrada', quantity: 1, note: null }],
      p_client_request_id: crypto.randomUUID(),
    })
    expect(wrongProduct.error).not.toBeNull()

    const wrongTransfer = await employeeClient!.rpc('apply_movement_batch', {
      p_company_id: companyA,
      p_entries: [{ product_id: productA, environment_id: environmentA, to_environment_id: environmentOtherB, type: 'transferencia', quantity: 1, note: null }],
      p_client_request_id: crypto.randomUUID(),
    })
    expect(wrongTransfer.error).not.toBeNull()
  })

  it('anon não aplica entrada em lote', async () => {
    const result = await anon.rpc('apply_movement_entry_batch', {
      p_company_id: companyA,
      p_environment_id: environmentA,
      p_entries: [{ product_id: productA, quantity: 1, note: null }],
      p_client_request_id: crypto.randomUUID(),
    })
    expect(result.error, 'anon aplicou entrada em lote').not.toBeNull()
  })

  it('UPDATE e DELETE em stock_movements falham', async () => {
    const created = await managerClient!.rpc('register_movement', { p_company_id: companyA, p_product_id: productA, p_environment_id: environmentA, p_type: 'entrada', p_quantity: 1 })
    expect(created.error).toBeNull()
    const updated = await admin.from('stock_movements').update({ note: 'proibido' }).eq('id', created.data).select('*')
    expect(updated.error || (updated.data ?? []).length === 0, 'service_role conseguiu alterar stock_movements').toBeTruthy()
    const deleted = await admin.from('stock_movements').delete().eq('id', created.data).select('*')
    expect(deleted.error || (deleted.data ?? []).length === 0, 'service_role conseguiu apagar stock_movements').toBeTruthy()
  })
})
