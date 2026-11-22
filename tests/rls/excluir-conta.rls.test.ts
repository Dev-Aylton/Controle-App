import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import {
  adminClient, anonClient, createTestUser, getAdminSession, loggedClient, loginUser,
  randomEmail, randomTestCode, rlsConfig, testPassword,
} from './helpers'

const suite = rlsConfig ? describe : describe.skip

suite('RLS exclusão de conta', () => {
  const admin = rlsConfig ? adminClient() : null
  const anon = rlsConfig ? anonClient() : null
  const users: User[] = []
  const ids = new Map<string, string>()
  const tokens = new Map<string, string>()
  let companyId = ''
  let environmentId = ''
  let productId = ''
  let employeeClient: ReturnType<typeof loggedClient> | null = null
  let ownerClient: ReturnType<typeof loggedClient> | null = null
  let appAdminClient: ReturnType<typeof loggedClient> | null = null
  let temporaryAdminUserId: string | null = null

  async function addUser(name: string) {
    if (!admin) throw new Error('Admin ausente')
    const email = randomEmail(name)
    const password = testPassword()
    const user = await createTestUser(admin, email, password)
    users.push(user)
    ids.set(name, user.id)
    const session = await loginUser(email, password)
    tokens.set(name, session.access_token)
    return loggedClient(session.access_token)
  }

  beforeAll(async () => {
    if (!admin) return
    ownerClient = await addUser('delete-owner')
    employeeClient = await addUser('delete-employee')
    const adminSession = await getAdminSession()
    appAdminClient = adminSession.client
    temporaryAdminUserId = adminSession.temporaryAdminUserId

    const company = await admin.from('companies').insert({ name: 'rls-test-delete-account' }).select('id').single()
    if (company.error || !company.data) throw new Error(`Falha empresa delete account: ${company.error?.message}`)
    companyId = company.data.id
    const code = await admin.from('company_codes').insert({
      company_id: companyId, code: randomTestCode('DEL'), version: 1, active: true, created_by: adminSession.userId,
    }).select('id').single()
    if (code.error || !code.data) throw new Error(`Falha código delete account: ${code.error?.message}`)
    const memberships = await admin.from('memberships').insert([
      { company_id: companyId, user_id: ids.get('delete-owner'), role: 'owner', active: true },
      { company_id: companyId, user_id: ids.get('delete-employee'), role: 'employee', active: true, code_id: code.data.id },
    ])
    if (memberships.error) throw new Error(`Falha vínculos delete account: ${memberships.error.message}`)
    const environment = await admin.from('environments').insert({ company_id: companyId, name: 'delete-ambiente', active: true }).select('id').single()
    const product = await admin.from('products').insert({ company_id: companyId, name: 'delete-produto', unit: 'un', active: true }).select('id').single()
    if (environment.error || product.error || !environment.data || !product.data) throw new Error('Falha setup produto/ambiente')
    environmentId = environment.data.id
    productId = product.data.id
    const movement = await employeeClient.rpc('register_movement', {
      p_company_id: companyId, p_product_id: productId, p_environment_id: environmentId,
      p_type: 'entrada', p_quantity: 1,
    })
    if (movement.error) throw new Error(`Falha movimento delete account: ${movement.error.message}`)
    await admin.from('profiles').update({
      name: 'Nome Histórico',
      avatar_url: 'profile.webp',
      avatar_key: 'profile.webp',
    }).eq('id', ids.get('delete-employee'))
  })

  afterAll(async () => {
    if (!admin) return
    if (temporaryAdminUserId) {
      await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
      await admin.auth.admin.deleteUser(temporaryAdminUserId)
    }
    if (companyId) await admin.from('companies').delete().eq('id', companyId)
    await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)))
  })

  it('anon não executa', async () => {
    if (!anon) throw new Error('Anon ausente')
    expect((await anon.rpc('delete_my_account')).error).not.toBeNull()
    expect((await anon.rpc('get_account_deletion_status')).error).not.toBeNull()
  })

  it('usuário solicita exclusão, mantém os dados na janela de 90 dias e pode reativar', async () => {
    if (!employeeClient || !admin) throw new Error('Setup incompleto')
    const userId = ids.get('delete-employee')
    const result = await employeeClient.rpc('delete_my_account')
    expect(result.error).toBeNull()
    const pending = await employeeClient.rpc('get_account_deletion_status')
    expect(pending.error).toBeNull()
    expect(pending.data).toHaveLength(1)
    expect(pending.data?.[0].status).toBe('pending')
    expect(pending.data?.[0].can_reactivate).toBe(true)

    const authUser = await admin.auth.admin.getUserById(userId!)
    expect(authUser.data.user?.email).toBeTruthy()
    expect(authUser.data.user?.phone ?? '').toBe('')
    expect(authUser.data.user?.identities?.length).toBeGreaterThan(0)
    const sessionCheck = await anonClient().auth.getUser(tokens.get('delete-employee'))
    expect(sessionCheck.error).not.toBeNull()
    const profile = await admin.from('profiles').select('name,avatar_url,avatar_key').eq('id', userId).single()
    expect(profile.error).toBeNull()
    expect(profile.data?.name).toBe('Nome Histórico')
    expect(profile.data?.avatar_url).toBe('profile.webp')
    expect(profile.data?.avatar_key).toBe('profile.webp')
    const membership = await admin.from('memberships').select('active').eq('user_id', userId)
    expect(membership.error).toBeNull()
    expect((membership.data ?? []).every((row) => row.active === false)).toBe(true)
    const movement = await admin.from('stock_movements').select('id,created_by').eq('created_by', userId).limit(1)
    expect(movement.error).toBeNull()
    expect(movement.data?.length).toBe(1)

    const reactivated = await employeeClient.rpc('reactivate_my_account')
    expect(reactivated.error).toBeNull()
    const statusAfterReactivation = await employeeClient.rpc('get_account_deletion_status')
    expect(statusAfterReactivation.error).toBeNull()
    expect(statusAfterReactivation.data).toHaveLength(0)
    const restoredMembership = await admin.from('memberships').select('active').eq('user_id', userId)
    expect(restoredMembership.error).toBeNull()
    expect((restoredMembership.data ?? []).every((row) => row.active === true)).toBe(true)
  })

  it('único proprietário ativo é bloqueado', async () => {
    if (!ownerClient) throw new Error('Owner ausente')
    expect((await ownerClient.rpc('delete_my_account')).error).not.toBeNull()
  })

  it('admin do app é bloqueado', async () => {
    if (!appAdminClient) throw new Error('Admin ausente')
    expect((await appAdminClient.rpc('delete_my_account')).error).not.toBeNull()
  })

  it('a exclusão não afeta outros usuários', async () => {
    if (!admin) throw new Error('Admin ausente')
    const owner = await admin.auth.admin.getUserById(ids.get('delete-owner')!)
    expect(owner.error).toBeNull()
    expect(owner.data.user?.id).toBe(ids.get('delete-owner'))
  })
})
