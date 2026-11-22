import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const migrationsDir = `${root}supabase/migrations`
const files = (await readdir(migrationsDir))
  .filter((name) => /^\d.*\.sql$/i.test(name))
  .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))

async function writeUnified(outputName, title, selectedFiles) {
  const parts = []
  for (const file of selectedFiles) {
  const sql = await readFile(`${migrationsDir}/${file}`, 'utf8')
    parts.push(`-- ============================================================\n-- Migration: ${file}\n-- ============================================================\n\n${sql.trim()}\n`)
  }
  await mkdir(`${root}supabase`, { recursive: true })
  await writeFile(
    `${root}supabase/${outputName}`,
    `-- ${title}\n-- Gerado por npm run sql:unir. Não aplicar automaticamente.\n\n${parts.join('\n')}`,
    'utf8',
  )
  console.log(`Unidas ${selectedFiles.length} migrations em supabase/${outputName}`)
}

await writeUnified('aplicar-etapa1.sql', 'Controle-App - Etapa 1', files.filter((file) => /^00[1-6]_/.test(file)))
await writeUnified('aplicar-etapa2.sql', 'Controle-App - Etapa 2', files.filter((file) => /^007_/.test(file)))
await writeUnified('aplicar-etapa3.sql', 'Controle-App - Etapa 3', files.filter((file) => /^009_/.test(file)))
await writeFile(`${root}supabase/aplicar-etapa4.sql`, await readFile(`${migrationsDir}/010_etapa4_gestao.sql`, 'utf8'), 'utf8')
console.log('Copiada migration 010 em supabase/aplicar-etapa4.sql')
await writeFile(`${root}supabase/aplicar-etapa4-equipe.sql`, await readFile(`${migrationsDir}/011_etapa4_equipe.sql`, 'utf8'), 'utf8')
console.log('Copiada migration 011 em supabase/aplicar-etapa4-equipe.sql')
await writeFile(`${root}supabase/aplicar-etapa4b.sql`, await readFile(`${migrationsDir}/012_etapa4b_compras_motivo.sql`, 'utf8'), 'utf8')
console.log('Copiada migration 012 em supabase/aplicar-etapa4b.sql')
await writeFile(`${root}supabase/aplicar-etapa5a.sql`, await readFile(`${migrationsDir}/013_etapa5a_vendas_sugestoes.sql`, 'utf8'), 'utf8')
console.log('Copiada migration 013 em supabase/aplicar-etapa5a.sql')
await writeFile(`${root}supabase/aplicar-etapa3b.sql`, await readFile(`${migrationsDir}/014_etapa3b_dose_zeragem.sql`, 'utf8'), 'utf8')
console.log('Copiada migration 014 em supabase/aplicar-etapa3b.sql')

const validation = spawnSync(process.execPath, ['scripts/validar-sql-etapa1.mjs'], {
  cwd: root,
  stdio: 'inherit',
})
if (validation.status !== 0) process.exit(validation.status ?? 1)
