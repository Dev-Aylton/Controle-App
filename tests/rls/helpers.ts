import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'

loadDotenv({ path: '.env.test', quiet: true })

export type RlsConfig = {
  url: string
  anonKey: string
  serviceRoleKey: string
}

export const rlsConfig: RlsConfig | null = (() => {
  const url = process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_TEST_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_TEST_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : null
})()

export function adminClient(): SupabaseClient {
  if (!rlsConfig) throw new Error('Configuração RLS ausente.')
  return createClient(rlsConfig.url, rlsConfig.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function assertAnonKeyIsNotPrivileged(config: RlsConfig) {
  let jwtRole: string | undefined
  try {
    const payload = config.anonKey.split('.')[1]
    if (payload) jwtRole = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role
  } catch {
    jwtRole = undefined
  }
  if (config.anonKey === config.serviceRoleKey || jwtRole === 'service_role' || config.anonKey.startsWith('sb_secret_')) {
    throw new Error('A chave anon configurada para os testes RLS é privilegiada (service_role/secret). Use a chave publishable/anon.')
  }
}

// Sempre cria uma instância nova, só com a chave anon. Nunca faça login nela.
export function anonClient(): SupabaseClient {
  if (!rlsConfig) throw new Error('Configuração RLS ausente.')
  assertAnonKeyIsNotPrivileged(rlsConfig)
  return createClient(rlsConfig.url, rlsConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function loggedClient(accessToken: string): SupabaseClient {
  if (!rlsConfig) throw new Error('Configuração RLS ausente.')
  assertAnonKeyIsNotPrivileged(rlsConfig)
  return createClient(rlsConfig.url, rlsConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export function randomEmail(prefix = 'rls-test') {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`
  return `${prefix}-${suffix}@example.com`
}

export const testPassword = () => `Rls-Test-${crypto.randomUUID()}-Aa1!`

export function randomTestCode(prefix = 'RLS') {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

export async function createTestUser(
  admin: SupabaseClient,
  email: string,
  password: string,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário RLS: ${error?.message ?? 'usuário não retornado'}${error?.code ? ` [${error.code}]` : ''}`)
  }
  return data.user
}

export async function loginUser(
  email: string,
  password: string,
) {
  let lastError: { message?: string; code?: string } | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password })
    if (data.session && !error) return data.session
    lastError = error
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
  }
  throw new Error(`Falha ao autenticar usuário RLS: ${lastError?.message ?? 'sessão não retornada'}${lastError?.code ? ` [${lastError.code}]` : ''}`)
}

export type RlsAdminSession = {
  client: SupabaseClient
  userId: string
  temporaryAdminUserId: string | null
}

export async function getAdminSession(): Promise<RlsAdminSession> {
  if (!rlsConfig) throw new Error('Configuração RLS ausente.')
  const admin = adminClient()

  const { data: admins, error: adminError } = await admin
    .from('app_admins')
    .select('user_id')
    .limit(1)
  if (adminError) {
    throw new Error(`Falha ao obter o admin real: ${adminError.message}${adminError.code ? ` [${adminError.code}]` : ''}`)
  }

  let adminUserId = admins?.[0]?.user_id as string | undefined
  let temporaryAdminUserId: string | null = null

  if (!adminUserId) {
    const email = randomEmail('rls-test-admin')
    const password = testPassword()
    const temp = await createTestUser(admin, email, password)
    const insert = await admin.from('app_admins').insert({ user_id: temp.id })
    if (insert.error) {
      await admin.auth.admin.deleteUser(temp.id)
      throw new Error(`Falha ao criar admin temporário RLS: ${insert.error.message}${insert.error.code ? ` [${insert.error.code}]` : ''}`)
    }
    adminUserId = temp.id
    temporaryAdminUserId = temp.id
  }

  let lastError: { message?: string; code?: string } | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(adminUserId)
    if (userError || !userData.user?.email) {
      lastError = userError
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
      continue
    }

    const email = userData.user.email
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      lastError = linkError
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
      continue
    }

    const { data: otpData, error: otpError } = await anonClient().auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    })
    if (otpError || !otpData.session) {
      lastError = otpError
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
      continue
    }

    return {
      client: loggedClient(otpData.session.access_token),
      userId: adminUserId,
      temporaryAdminUserId,
    }
  }

  if (temporaryAdminUserId) {
    await admin.from('app_admins').delete().eq('user_id', temporaryAdminUserId)
    await admin.auth.admin.deleteUser(temporaryAdminUserId)
  }
  throw new Error(`Falha ao obter sessão do admin RLS: ${lastError?.message ?? 'sessão não retornada'}${lastError?.code ? ` [${lastError.code}]` : ''}`)
}

export function expectPermissionError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return /permission denied|row-level security|policy|PGRST|not authorized/i.test(
    `${error.message ?? ''} ${error.code ?? ''}`,
  )
}

export const hasPermissionError = expectPermissionError
