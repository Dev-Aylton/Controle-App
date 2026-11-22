type TechnicalError = { at: string; origin: string; message: string }

const technicalErrors: TechnicalError[] = []

export function recordTechnicalError(origin: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  technicalErrors.unshift({ at: new Date().toISOString(), origin, message })
  technicalErrors.splice(20)
}

export function getTechnicalErrors() {
  return technicalErrors.map((entry) => ({ ...entry }))
}

export function createSevenClickCounter(onOpen: () => void, windowMs = 3000) {
  let firstAt = 0
  let count = 0
  return () => {
    const now = Date.now()
    if (!firstAt || now - firstAt > windowMs) {
      firstAt = now
      count = 1
      return
    }
    count += 1
    if (count >= 7) {
      count = 0
      firstAt = 0
      onOpen()
    }
  }
}

function redact(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail removido]')
    .replace(/[A-Za-z0-9_-]{20,}/g, '[valor removido]')
    .replace(/(?:bearer|token|key|secret|password|senha)\s*[:=]\s*\S+/gi, '$& [removido]')
}

export function buildDiagnosticText(input: {
  version: string
  build: string
  online: boolean
  layout: string
  role: string
  companyId: string
  pending: number
  width: number
  height: number
  browser: string
}) {
  const lines = [
    `Versão: ${input.version}`,
    `Build: ${input.build}`,
    `Conexão: ${input.online ? 'online' : 'offline'}`,
    `Tela: ${input.layout} (${input.width}x${input.height})`,
    `Navegador: ${input.browser}`,
    `Cargo: ${input.role}`,
    `Empresa: ${input.companyId.slice(0, 8) || 'nenhuma'}`,
    `Fila offline: ${input.pending} pendente(s)`,
    `Data/hora: ${new Date().toLocaleString('pt-BR')}`,
    'Últimos erros técnicos:',
    ...getTechnicalErrors().map((entry) => `${entry.at} | ${redact(entry.origin)} | ${redact(entry.message)}`),
  ]
  return lines.join('\n')
}

export function buildSanitizedMailDiagnostic(input: Parameters<typeof buildDiagnosticText>[0]) {
  return buildDiagnosticText(input)
    .split('\n')
    .filter((line) => !line.includes('Últimos erros técnicos:') && !line.includes('|'))
    .map(redact)
    .join('\n')
}
