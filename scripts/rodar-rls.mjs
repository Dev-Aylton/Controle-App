import { mkdir, rm, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const root = fileURLToPath(new URL('../', import.meta.url))
const tempDir = `${root}.tmp-acompanhamento`
await mkdir(tempDir, { recursive: true })
await rm(`${tempDir}/rls.json`, { force: true })

const envMissing = !existsSync(`${root}.env.test`)
if (envMissing) {
  console.log('RLS: .env.test não existe; os testes RLS serão coletados como pulados.')
}

const result = spawnSync(
  process.execPath,
  [
    '--env-file-if-exists=.env.test',
    'node_modules/vitest/vitest.mjs',
    'run',
    'tests/rls',
    '--config',
    'vitest.rls.config.ts',
    '--reporter=default',
    '--reporter=json',
    `--outputFile=${tempDir}/rls.json`,
  ],
  { cwd: root, stdio: 'inherit' },
)

let report
try {
  report = JSON.parse(await readFile(`${tempDir}/rls.json`, 'utf8'))
} catch {
  report = null
}

const total = report?.numTotalTests ?? 0
const failed = report?.numFailedTests ?? 0
const passed = report?.numPassedTests ?? 0
const pending = report?.numPendingTests ?? report?.numTodoTests ?? 0

if (total === 0) {
  console.error('ERRO: nenhum teste RLS foi coletado. Verifique vitest.rls.config.ts e tests/rls/**/*.test.ts.')
  process.exit(1)
}

if (result.status !== 0 || failed > 0) {
  console.error(`RLS: ${failed} falha(s), ${passed} aprovado(s), ${pending} pulado(s).`)
  process.exit(result.status || 1)
}

console.log(`RLS coletado: ${total} teste(s); ${passed} aprovado(s), ${pending} pulado(s), ${failed} falha(s).`)
