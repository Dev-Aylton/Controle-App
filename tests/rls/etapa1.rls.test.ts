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
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

if (!rlsConfig) {
  console.info('RLS ignorado: configure VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY no .env.test.')
}

suite('RLS Etapa 1', () => {
  const admin = rlsConfig ? adminClient() : null as unknown as ReturnType<typeof adminClient>
  // Cliente anônimo dedicado: nunca passe este cliente para loginUser/verifyOtp/setSession.
  const anon = rlsConfig ? anonClient() : null as unknown as ReturnType<typeof anonClient>
  const users: User[] = []
  const createdUsers = new Map<string, { id: string; email: string }>()
  const clientByName = new Map<string, ReturnType<typeof loggedClient>>()
  const tokenByName = new Map<string, string>()
  let companyA = ''
  let companyB = ''
  let codeA = ''
  let codeB = ''
  let profileBucketExists = false
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
    tokenByName.set(name, session.access_token)
    clientByName.set(name, loggedClient(session.access_token))
    return user
  }

  beforeAll(async () => {
    try {
    const [
      ownerA,
      managerA,
      employeeA,
      ownerB,
      outsider,
      employeePromote,
      employeePromoteManager,
      employeeDeactivate,
      ownerLimit2,
      ownerLimit3,
      ownerLimit4,
      employeeLogo,
    ] = await Promise.all([
      addUser('owner-a'),
      addUser('manager-a'),
      addUser('employee-a'),
      addUser('owner-b'),
      addUser('outsider'),
      addUser('employee-promote'),
      addUser('employee-promote-manager'),
      addUser('employee-deactivate'),
      addUser('owner-limit-2'),
      addUser('owner-limit-3'),
      addUser('owner-limit-4'),
      addUser('employee-logo'),
    ])
    void outsider
    void ownerLimit4
    const adminSession = await getAdminSession()
    const adminLogged = adminSession.client
    adminSessionUserId = adminSession.userId
    temporaryAdminUserId = adminSession.temporaryAdminUserId
    clientByName.set('admin', adminLogged)

    const { data: companies, error: companyError } = await admin
      .from('companies')
      .insert([
        { name: 'rls-test-empresa-a', phone: '11999999999' },
        { name: 'rls-test-empresa-b', phone: '11888888888' },
      ])
      .select('*')
      .order('name')
    if (companyError) throw new Error(`Falha ao preparar empresas RLS: ${companyError.message}${companyError.code ? ` [${companyError.code}]` : ''}`)
    if (!companies || companies.length !== 2) throw new Error('Falha ao preparar empresas RLS: o banco não retornou 2 empresas.')
    companyA = companies.find((company) => company.name === 'rls-test-empresa-a')?.id ?? ''
    companyB = companies.find((company) => company.name === 'rls-test-empresa-b')?.id ?? ''
    if (!companyA || !companyB) throw new Error('Falha ao preparar empresas RLS: IDs não retornados.')
    companyAId = companyA
    companyBId = companyB

    const { data: codeRows, error: codeError } = await admin
      .from('company_codes')
      .insert([
        { company_id: companyA, code: randomTestCode('ET1A'), version: 1, active: true, created_by: adminSessionUserId },
        { company_id: companyB, code: randomTestCode('ET1B'), version: 1, active: true, created_by: adminSessionUserId },
      ])
      .select('*')
    if (codeError || !codeRows) throw new Error('Falha ao preparar códigos RLS.')
    codeA = codeRows.find((code) => code.company_id === companyA)?.code ?? codeA
    codeB = codeRows.find((code) => code.company_id === companyB)?.code ?? codeB

    const membershipRows = [
      { user_id: ownerA.id, company_id: companyA, role: 'owner', active: true, code_id: null },
      { user_id: managerA.id, company_id: companyA, role: 'manager', active: true, code_id: null },
      { user_id: employeeA.id, company_id: companyA, role: 'employee', active: true, code_id: codeRows.find((code) => code.company_id === companyA)?.id },
      { user_id: ownerB.id, company_id: companyB, role: 'owner', active: true, code_id: null },
      { user_id: employeePromote.id, company_id: companyA, role: 'employee', active: true, code_id: codeRows.find((code) => code.company_id === companyA)?.id },
      { user_id: employeePromoteManager.id, company_id: companyA, role: 'employee', active: true, code_id: codeRows.find((code) => code.company_id === companyA)?.id },
      { user_id: employeeDeactivate.id, company_id: companyA, role: 'employee', active: true, code_id: codeRows.find((code) => code.company_id === companyA)?.id },
      { user_id: ownerLimit2.id, company_id: companyA, role: 'owner', active: true, code_id: null },
      { user_id: ownerLimit3.id, company_id: companyA, role: 'owner', active: true, code_id: null },
      { user_id: employeeLogo.id, company_id: companyA, role: 'employee', active: true, code_id: codeRows.find((code) => code.company_id === companyA)?.id },
    ]
    const { error: membershipError } = await admin.from('memberships').insert(membershipRows)
    if (membershipError) throw new Error(`Falha ao preparar vínculos RLS: ${membershipError.message}${membershipError.code ? ` [${membershipError.code}]` : ''}`)

    const { data: buckets } = await admin.storage.listBuckets()
    profileBucketExists = (buckets ?? []).some((bucket) => bucket.name === 'profile-photos')
    } catch (caught) {
      if (companyAId) await admin.from('companies').delete().eq('id', companyAId)
      if (companyBId) await admin.from('companies').delete().eq('id', companyBId)
      if (temporaryAdminUserId) {
        await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      }
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

  it('anon não lê tabelas protegidas', async () => {
    const { data: sess } = await anon.auth.getSession()
    expect(sess.session, 'cliente anon tem sessão ativa').toBeNull()
    const tables = ['companies', 'memberships', 'company_codes', 'company_invites', 'audit_log', 'profiles', 'app_admins']
    for (const table of tables) {
      const { data, error } = await anon.from(table).select('*').limit(1)
      expect(Boolean(error) || (data ?? []).length === 0, `anon leu ou obteve acesso inesperado na tabela ${table}`).toBe(true)
    }
  })

  it('anon não executa funções protegidas do app', async () => {
    const { data: sess } = await anon.auth.getSession()
    expect(sess.session, 'cliente anon tem sessão ativa').toBeNull()
    const helperCalls = [
      ['is_admin', {}],
      ['is_active_member', { p_company_id: companyA }],
      ['member_role', { p_company_id: companyA }],
      ['is_manager_or_owner', { p_company_id: companyA }],
    ] as const
    for (const [name, args] of helperCalls) {
      const result = await anon.rpc(name, args)
      expect(result.error !== null || !result.data, `função helper ${name} revelou estado privilegiado ao anônimo`).toBe(true)
    }

    const mutationCalls = [
      ['rotate_company_code', { p_company_id: companyA }],
      ['join_company_with_code', { p_code: 'INVALID-00000' }],
      ['claim_invites', {}],
      ['create_invite', { p_company_id: companyA, p_email: 'anon@example.com', p_role: 'manager' }],
      ['promote_to_manager', { p_membership_id: '00000000-0000-0000-0000-000000000001' }],
      ['deactivate_member', { p_membership_id: '00000000-0000-0000-0000-000000000001' }],
    ] as const
    for (const [name, args] of mutationCalls) {
      const result = await anon.rpc(name, args)
      expect(result.error, `função mutadora ${name} executou sem autenticação`).not.toBeNull()
    }
  })

  it('usuário da empresa A não lê dados da empresa B', async () => {
    const employee = clientByName.get('employee-a')
    if (!employee) throw new Error('Usuário RLS não preparado.')
    const { data: companyRows } = await employee.from('companies').select('*').eq('id', companyB)
    expect(companyRows ?? []).toHaveLength(0)
    const { data: membershipRows } = await employee.from('memberships').select('*').eq('company_id', companyB)
    expect(membershipRows ?? []).toHaveLength(0)
    const { data: codeRows } = await employee.from('company_codes').select('*').eq('company_id', companyB)
    expect(codeRows ?? []).toHaveLength(0)
    const { data: inviteRows } = await employee.from('company_invites').select('*').eq('company_id', companyB)
    expect(inviteRows ?? []).toHaveLength(0)
    const { data: auditRows } = await employee.from('audit_log').select('*').eq('company_id', companyB)
    expect(auditRows ?? []).toHaveLength(0)
  })

  it('usuário da empresa A não altera empresa B', async () => {
    const employee = clientByName.get('employee-a')
    if (!employee) throw new Error('Usuário RLS não preparado.')
    const { data } = await employee.from('companies').update({ name: 'Proibido' }).eq('id', companyB).select('*')
    expect(data ?? []).toHaveLength(0)
    const membershipUpdate = await employee.from('memberships').update({ role: 'owner' }).eq('company_id', companyB).select('*')
    expect(membershipUpdate.data ?? []).toHaveLength(0)
    const codeUpdate = await employee.from('company_codes').update({ active: false }).eq('company_id', companyB).select('*')
    expect(codeUpdate.data ?? []).toHaveLength(0)
    const inviteUpdate = await employee.from('company_invites').update({ used_at: new Date().toISOString() }).eq('company_id', companyB).select('*')
    expect(inviteUpdate.data ?? []).toHaveLength(0)
    const auditUpdate = await employee.from('audit_log').update({ action: 'proibido' }).eq('company_id', companyB).select('*')
    expect(auditUpdate.data ?? []).toHaveLength(0)
  })

  it('cargos leem código apenas admin, proprietário e gerente', async () => {
    for (const name of ['employee-a']) {
      const client = clientByName.get(name)
      const { data } = await client!.from('company_codes').select('*').eq('company_id', companyA)
      expect(data ?? []).toHaveLength(0)
    }
    for (const name of ['owner-a', 'manager-a']) {
      const client = clientByName.get(name)
      const { data } = await client!.from('company_codes').select('*').eq('company_id', companyA)
      expect(data?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('funcionário não lê equipe completa', async () => {
    const employee = clientByName.get('employee-a')
    const employeeUser = createdUsers.get('employee-a')
    const { data } = await employee!.from('memberships').select('*').eq('company_id', companyA)
    expect((data ?? []).every((membership) => membership.user_id === employeeUser?.id), 'funcionário recebeu membership de outro usuário').toBe(true)
  })

  it('join com código válido entra como funcionário e códigos inválidos falham', async () => {
    const outsider = clientByName.get('outsider')
    const valid = await outsider!.rpc('join_company_with_code', { p_code: codeA })
    expect(valid.error).toBeNull()
    const invalid = await outsider!.rpc('join_company_with_code', { p_code: 'INVALID-00000' })
    expect(invalid.error).not.toBeNull()
  })

  it('troca de código bloqueia código antigo e desativado não reativa', async () => {
    const adminClientLogged = clientByName.get('admin')
    if (!adminClientLogged) throw new Error('Admin RLS não preparado.')
    const rotated = await adminClientLogged.rpc('rotate_company_code', { p_company_id: companyA })
    expect(rotated.error).toBeNull()
    expect(rotated.data).toBeTruthy()
    const outsider = clientByName.get('outsider')
    const oldCode = await outsider!.rpc('join_company_with_code', { p_code: codeA })
    expect(oldCode.error).not.toBeNull()
    const newCode = await outsider!.rpc('join_company_with_code', { p_code: rotated.data })
    expect(newCode.error).toBeNull()

    const employee = createdUsers.get('employee-deactivate')
    const employeeId = employee?.id
    if (!employeeId) throw new Error('Usuário de desativação não preparado.')
    await admin.from('memberships').update({ active: false, deactivated_at: new Date().toISOString(), deactivated_by: adminSessionUserId }).eq('user_id', employeeId)
    const deactivatedClient = clientByName.get('employee-deactivate')
    const deactivated = await deactivatedClient!.rpc('join_company_with_code', { p_code: rotated.data })
    expect(deactivated.error).not.toBeNull()
  })

  it('proprietário promove funcionário ativo, gerente e funcionário não promovem', async () => {
    const owner = clientByName.get('owner-a')
    const employeeToPromote = createdUsers.get('employee-promote')
    const employeeToRemain = createdUsers.get('employee-promote-manager')
    if (!employeeToPromote || !employeeToRemain) throw new Error('Funcionários de promoção não foram preparados.')
    const target = await admin.from('memberships').select('id').eq('company_id', companyA).eq('user_id', employeeToPromote.id).maybeSingle()
    expect(target.data?.id, 'membership do funcionário a promover não foi preparada').toBeTruthy()
    const promoted = await owner!.rpc('promote_to_manager', { p_membership_id: target.data?.id })
    expect(promoted.error).toBeNull()
    const manager = clientByName.get('manager-a')
    const second = await admin.from('memberships').select('id').eq('company_id', companyA).eq('user_id', employeeToRemain.id).maybeSingle()
    expect(second.data?.id, 'membership do funcionário de controle não foi preparada').toBeTruthy()
    expect((await manager!.rpc('promote_to_manager', { p_membership_id: second.data?.id })).error).not.toBeNull()
    const employee = clientByName.get('employee-a')
    expect((await employee!.rpc('promote_to_manager', { p_membership_id: second.data?.id })).error).not.toBeNull()
  })

  it('gerente desativa funcionário e o registro permanece desativado', async () => {
    const manager = clientByName.get('manager-a')
    const target = createdUsers.get('employee-deactivate')
    const membership = await admin.from('memberships').select('id').eq('user_id', target?.id).eq('company_id', companyA).maybeSingle()
    expect(membership.data?.id, 'membership do usuário de desativação não foi preparada').toBeTruthy()
    const result = await manager!.rpc('deactivate_member', { p_membership_id: membership.data?.id })
    expect(result.error).toBeNull()
    const row = await admin.from('memberships').select('id,active,deactivated_at').eq('id', membership.data?.id).maybeSingle()
    expect(row.data?.active).toBe(false)
  })

  it('limite de até três proprietários ativos é aplicado', async () => {
    const limit4 = createdUsers.get('owner-limit-4')
    const { error } = await admin.from('memberships').insert({
      user_id: limit4?.id,
      company_id: companyA,
      role: 'owner',
      active: true,
      code_id: null,
    })
    expect(error).not.toBeNull()
  })

  it('usuário comum não lê ou escreve app_admins e não se promove', async () => {
    const employee = clientByName.get('employee-a')
    const employeeUser = createdUsers.get('employee-a')
    const read = await employee!.from('app_admins').select('*')
    expect(read.data ?? [], 'usuário comum leu linhas de app_admins').toHaveLength(0)
    const write = await employee!.from('app_admins').insert({ user_id: employeeUser?.id })
    expect(write.error, 'usuário comum conseguiu se inserir em app_admins').not.toBeNull()
  })

  it('profiles permite ler e editar somente o próprio perfil', async () => {
    const employee = clientByName.get('employee-a')
    const employeeUser = createdUsers.get('employee-a')
    const ownerUser = createdUsers.get('owner-a')
    const own = await employee!.from('profiles').select('*').eq('id', employeeUser?.id)
    expect(own.data?.length ?? 0).toBeGreaterThan(0)
    const updateOwn = await employee!.from('profiles').update({ name: 'Nome RLS Teste' }).eq('id', employeeUser?.id).select('*')
    expect(updateOwn.error).toBeNull()
    const updateOther = await employee!.from('profiles').update({ name: 'Proibido' }).eq('id', ownerUser?.id).select('*')
    expect(updateOther.data ?? []).toHaveLength(0)
  })

  it('logo da empresa respeita membros autorizados', async () => {
    const bucket = 'company-photos'
    const bytes = new Uint8Array([1, 2, 3])
    const uploaded: string[] = []
    try {
      // Verificação positiva: owner e gerente sobem em companies/<companyId>/logo-<uuid>.webp
      for (const name of ['owner-a', 'manager-a']) {
        const client = clientByName.get(name)
        const who = createdUsers.get(name)
        const path = `companies/${companyA}/logo-${crypto.randomUUID()}.webp`
        expect(client, `cliente ${name} não foi criado`).toBeDefined()
        const result = await client!.storage.from(bucket).upload(path, bytes, { contentType: 'image/webp', upsert: true })
        if (!result.error) uploaded.push(path)
        expect(
          result.error,
          `${name} não conseguiu subir: user=${who?.email} company=${companyA} path=${path} erro=${result.error?.message ?? ''}`,
        ).toBeNull()
      }

      // O cliente do upload negado precisa ser realmente o employee-logo dedicado.
      const employee = clientByName.get('employee-logo')
      const employeeUser = createdUsers.get('employee-logo')
      const employeeToken = tokenByName.get('employee-logo')
      expect(employee, 'cliente do funcionário employee-logo não foi criado').toBeDefined()
      expect(employeeToken, 'token do funcionário employee-logo não foi guardado').toBeTruthy()
      const { data: tokenOwner, error: tokenError } = await anonClient().auth.getUser(employeeToken)
      expect(
        tokenOwner.user?.id,
        `token de employee-logo não pertence ao funcionário dedicado (${tokenError?.message ?? 'id diferente'})`,
      ).toBe(employeeUser?.id)

      const { data: membership } = await admin
        .from('memberships')
        .select('role,active')
        .eq('user_id', employeeUser?.id)
        .eq('company_id', companyA)
        .maybeSingle()
      expect(membership?.role, 'employee-logo não é funcionário no momento do upload').toBe('employee')
      expect(membership?.active, 'employee-logo não está ativo no momento do upload').toBe(true)

      const deniedPath = `companies/${companyA}/logo-denied-${crypto.randomUUID()}.webp`
      const denied = await employee!.storage.from(bucket).upload(deniedPath, bytes, { contentType: 'image/webp', upsert: true })
      if (!denied.error) uploaded.push(deniedPath)
      expect(
        denied.error,
        `upload negado falhou: user=${employeeUser?.email} role=${membership?.role} active=${membership?.active} company=${companyA} path=${deniedPath}`,
      ).not.toBeNull()
    } finally {
      if (uploaded.length) await admin.storage.from(bucket).remove(uploaded)
    }
  })

  it('profile-photos respeita a própria pasta quando o bucket existe', async () => {
    if (!profileBucketExists) return
    const employee = clientByName.get('employee-a')
    const employeeUser = createdUsers.get('employee-a')
    const own = await employee!.storage.from('profile-photos').upload(
      `${employeeUser?.id}/avatar.webp`,
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/webp', upsert: true },
    )
    expect(own.error, 'usuário não conseguiu acessar sua própria pasta profile-photos').toBeNull()
    const ownerUser = createdUsers.get('owner-a')
    const other = await employee!.storage.from('profile-photos').upload(
      `${ownerUser?.id}/avatar.webp`,
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/webp', upsert: true },
    )
    expect(other.error, 'usuário conseguiu escrever na pasta profile-photos de outro usuário').not.toBeNull()
  })
})
