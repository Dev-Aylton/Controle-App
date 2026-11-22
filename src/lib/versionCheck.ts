export type PublishedVersion = { version: string; build: string }

export function isNewerVersion(current: PublishedVersion, published: PublishedVersion) {
  return current.version !== published.version || current.build !== published.build
}

export async function checkPublishedVersion(baseUrl = import.meta.env.BASE_URL) {
  const response = await fetch(`${baseUrl}version.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Não foi possível verificar atualização.')
  return await response.json() as PublishedVersion
}

export function buildReportBody(version: string, build: string, summary: string) {
  return [
    'Relatar problema no Controle-App',
    `Versão: ${version}`,
    `Build: ${build}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    '',
    summary,
  ].join('\n')
}
