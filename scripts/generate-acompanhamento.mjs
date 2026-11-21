import { readFile, writeFile } from 'node:fs/promises'
import { URL, fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

async function generateJsonJs(relativeJson, relativeJs, variableName) {
  const jsonPath = `${root}${relativeJson}`
  const jsPath = `${root}${relativeJs}`
  const json = await readFile(jsonPath, 'utf8')
  JSON.parse(json)
  await writeFile(jsPath, `window.${variableName} = ${json.trim()};\n`, 'utf8')
}

await generateJsonJs(
  'docs/acompanhamento/plano/plano.json',
  'docs/acompanhamento/plano/plano.dados.js',
  'PLANO_DATA',
)
await generateJsonJs(
  'docs/acompanhamento/testes/resultados.json',
  'docs/acompanhamento/testes/resultados.dados.js',
  'RESULTADOS_DATA',
)
