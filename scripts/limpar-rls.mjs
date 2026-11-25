import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadDotenv({ path: '.env.test', quiet: true })

const url = process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_TEST_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_TEST_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRoleKey) {
  console.log('Limpeza RLS: configuração incompleta; nenhum dado foi alterado.')
  process.exit(0)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

let removedUsers = 0
let removedCompanies = 0
let page = 1
const testUserIds = []

const { data: adminRows } = await admin
  .from('app_admins')
  .select('user_id')
const realAdminIds = new Set((adminRows ?? []).map((row) => row.user_id))

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`Falha ao listar usuários RLS: ${error.message}${error.code ? ` [${error.code}]` : ''}`)
  const users = data?.users ?? []
  for (const user of users) {
    if (user.email?.startsWith('rls-test-') && !realAdminIds.has(user.id)) {
      testUserIds.push(user.id)
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
      if (!deleteError) removedUsers++
    }
  }
  if (users.length < 1000) break
  page++
}

if (testUserIds.length) {
  await admin.from('app_admins').delete().in('user_id', testUserIds)
}

const { data: allCompanies, error: companyError } = await admin
  .from('companies')
  .select('id,name')
if (companyError) throw new Error(`Falha ao listar empresas RLS: ${companyError.message}${companyError.code ? ` [${companyError.code}]` : ''}`)

const syntheticCompanyPattern = /^rls-test-|^Nova empresa \d{2}\/\d{2}\/\d{4}$/i
const namedCompanies = (allCompanies ?? []).filter((company) =>
  syntheticCompanyPattern.test(company.name ?? '')
  || /delete-account/i.test(company.name ?? ''),
)

for (const company of namedCompanies) {
  await admin.from('stock_movements').delete().eq('company_id', company.id)
  await admin.from('inventory_counts').delete().in('session_id', (
    (await admin.from('inventory_sessions').select('id').eq('company_id', company.id)).data ?? []
  ).map((session) => session.id))
  await admin.from('inventory_sessions').delete().eq('company_id', company.id)
  const { error: deleteError } = await admin.from('companies').delete().eq('id', company.id)
  if (!deleteError) removedCompanies++
}

console.log(`Limpeza RLS concluída: ${removedCompanies} empresa(s) e ${removedUsers} usuário(s) removidos.`)
