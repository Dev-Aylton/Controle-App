import { recordTechnicalError } from './diagnostics'

export function traduzirErro(error: unknown, fallback = 'Não foi possível concluir a ação. Tente novamente.'): string {
  recordTechnicalError('erro-aplicacao', error)
  const record = error as { message?: string; code?: string; status?: number }
  const message = record.message ?? (error instanceof Error ? error.message : String(error))
  const code = record.code ?? ''
  const source = `${code} ${message} ${record.status ?? ''}`
  if (/invalid_credentials|invalid login credentials/i.test(source)) return 'E-mail ou senha inválidos.'
  if (/email_not_confirmed|email not confirmed/i.test(source)) return 'Confirme seu e-mail antes de entrar.'
  if (/signup_disabled/i.test(source)) return 'Cadastros por e-mail estão temporariamente desativados.'
  if (/too_many_requests|429/.test(source)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (/saldo insuficiente/i.test(message)) return 'Saldo insuficiente no ambiente.'
  if (/movement already reversed|transfer already reversed/i.test(message)) return 'Esta movimentação já foi estornada.'
  if (/cannot reverse an estorno/i.test(message)) return 'Não é possível estornar um estorno.'
  if (/15 minute|15 minutos|correction window/i.test(message)) return 'A janela de 15 minutos para correção expirou.'
  if (/active membership|required|vínculo|deactivated|desativad/i.test(message)) return 'Você não possui vínculo ativo nesta empresa.'
  if (/authentication required/i.test(message)) return 'Entre novamente para continuar.'
  if (/conta administradora do app/i.test(message)) return 'A conta administradora do app não pode ser excluída.'
  if (/Transfira a propriedade/i.test(message)) return 'Transfira a propriedade da empresa antes de excluir sua conta.'
  if (/invalid.*code|código.*inválido/i.test(message)) return 'Código da empresa inválido ou trocado.'
  if (/Produto sem volume|dose cadastrada|dose válida/i.test(message)) return 'Cadastre volume e dose válidos para lançar por dose.'
  if (/permission denied|row-level security|rls|not authorized|only owner|somente proprietário|Somente gestor|Somente administrador/i.test(message)) {
    return 'Você não tem permissão para esta ação.'
  }
  if (/network|failed to fetch|fetch|timeout|offline/i.test(message)) return 'Sem conexão. Tente novamente.'
  return fallback
}

export const friendlySupabaseError = traduzirErro
