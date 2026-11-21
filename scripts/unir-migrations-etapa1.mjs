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

const validation = spawnSync(process.execPath, ['scripts/validar-sql-etapa1.mjs'], {
  cwd: root,
  stdio: 'inherit',
})
if (validation.status !== 0) process.exit(validation.status ?? 1)
