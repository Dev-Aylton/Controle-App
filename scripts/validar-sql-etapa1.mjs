import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseSync, parsePlPgSQL } from 'libpg-query'
import { findUnsafeRoleChecks } from './sql-role-safety.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const migrationsDir = `${root}supabase/migrations`
const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => /^\d.*\.sql$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))

let failed = false

const createdTables = new Set(['auth.users', 'storage.objects', 'storage.buckets'])
const createdTypes = new Set(['public.company_role'])
const createdFunctions = new Set()
const createdPolicies = new Set()
const createdTriggers = new Set()

function dependencyCheck(file, sql) {
  const tableCreates = [...sql.matchAll(/create table(?: if not exists)? ([a-zA-Z0-9_.]+)/gi)]
  const typeCreates = [...sql.matchAll(/create type ([a-zA-Z0-9_.]+)/gi)]
  const functionCreates = [...sql.matchAll(/create or replace function ([a-zA-Z0-9_.]+)/gi)]
  const policyCreates = [...sql.matchAll(/create policy "([^"]+)"\s+on ([a-zA-Z0-9_.]+)/gi)]
  const triggerCreates = [...sql.matchAll(/create trigger ([a-zA-Z0-9_.]+)\s+[\s\S]*?\s+on ([a-zA-Z0-9_.]+)/gi)]

  for (const [, typeName] of typeCreates) createdTypes.add(typeName.toLowerCase())
  for (const [, tableName] of tableCreates) createdTables.add(tableName.toLowerCase())

  for (const [, functionName] of functionCreates) {
    const key = functionName.toLowerCase()
    if (createdFunctions.has(key) && !(
      (file === '010_etapa4_gestao.sql' && key === 'public.import_products')
      || (file === '015_etapa5b_vendas_financeiro.sql' && ['public.import_sales_batch', 'public.get_purchase_list'].includes(key))
    )) {
      failed = true
      console.error(`Nome duplicado de função em ${file}: ${functionName}`)
    }
    createdFunctions.add(key)
  }

  for (const [match, policyName, tableName] of policyCreates) {
    if (!createdTables.has(tableName.toLowerCase())) {
      failed = true
      console.error(`CREATE POLICY em tabela inexistente em ${file}: ${tableName} (${match})`)
    }
    const key = `${tableName.toLowerCase()}.${policyName.toLowerCase()}`
    if (createdPolicies.has(key)) {
      failed = true
      console.error(`Nome duplicado de política em ${file}: ${policyName}`)
    }
    createdPolicies.add(key)
  }

  for (const [, triggerName, tableName] of triggerCreates) {
    if (!createdTables.has(tableName.toLowerCase()) && !['auth.users'].includes(tableName.toLowerCase())) {
      failed = true
      console.error(`Trigger em tabela inexistente em ${file}: ${tableName}`)
    }
    const key = `${tableName.toLowerCase()}.${triggerName.toLowerCase()}`
    if (createdTriggers.has(key)) {
      failed = true
      console.error(`Nome duplicado de trigger em ${file}: ${triggerName}`)
    }
    createdTriggers.add(key)
  }

  for (const reference of sql.matchAll(/references ([a-zA-Z0-9_.]+)/gi)) {
    const referenceName = reference[1].toLowerCase()
    if (!createdTables.has(referenceName) && !['auth.users'].includes(referenceName)) {
      failed = true
      console.error(`Referência antes da criação da tabela em ${file}: ${referenceName}`)
    }
  }
}

async function parseFile(relativePath, sql) {
  try {
    parseSync(sql)
  } catch (error) {
    failed = true
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Erro SQL em ${relativePath}: ${message}`)
  }

  const plpgsqlBlocks = sql.match(/create or replace function[\s\S]*?\$\$\s*(?:language\s+plpgsql\s*)?;/gi) ?? []
  for (const block of plpgsqlBlocks) {
    if (!block.toLowerCase().includes('language plpgsql') && !block.toLowerCase().includes('returns trigger')) continue
    try {
      await parsePlPgSQL(block)
    } catch (error) {
      failed = true
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Erro PL/pgSQL em ${relativePath}: ${message}`)
    }
  }
}

for (const file of migrationFiles) {
  const sql = await readFile(`${migrationsDir}/${file}`, 'utf8')
  for (const risk of findUnsafeRoleChecks(sql)) {
    failed = true
    console.error(`Checagem de cargo NULL-risco em ${file}:${risk.line}: ${risk.text}`)
  }
  dependencyCheck(file, sql)
  await parseFile(`supabase/migrations/${file}`, sql)
}

for (const unifiedName of ['aplicar-etapa1.sql', 'aplicar-etapa2.sql', 'aplicar-etapa3.sql', 'aplicar-etapa4.sql', 'aplicar-etapa4-equipe.sql', 'aplicar-etapa4b.sql', 'aplicar-etapa5a.sql', 'aplicar-etapa3b.sql']) {
  const unifiedPath = `${root}supabase/${unifiedName}`
  try {
    const unified = await readFile(unifiedPath, 'utf8')
    await parseFile(`supabase/${unifiedName}`, unified)
  } catch (error) {
    failed = true
    console.error(`Erro ao ler supabase/${unifiedName}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const patchFiles = (await readdir(`${root}supabase/patches`)).filter((name) => /\.sql$/i.test(name)).sort()
for (const file of patchFiles) {
  const patch = await readFile(`${root}supabase/patches/${file}`, 'utf8')
  // 011 já foi aplicado; 013 substitui a única função com fallback de enum vazio.
  for (const risk of file === '011-fix-ownership-checks.sql' ? [] : findUnsafeRoleChecks(patch)) {
    failed = true
    console.error(`Checagem de cargo NULL-risco em supabase/patches/${file}:${risk.line}: ${risk.text}`)
  }
  await parseFile(`supabase/patches/${file}`, patch)
}

if (failed) process.exit(1)
console.log(`Sintaxe PostgreSQL validada: ${migrationFiles.length} migrations e supabase/aplicar-etapa1.sql`)
