import { recordTechnicalError } from './diagnostics'

export function traduzirErro(error: unknown, fallback = 'Não foi possível concluir a ação. Tente novamente.'): string {
  recordTechnicalError('erro-aplicacao', error)
  const record = error as { message?: string; code?: string; status?: number }
  const message = record.message ?? (error instanceof Error ? error.message : String(error))
  const code = record.code ?? ''
  const source = `${code} ${message} ${record.status ?? ''}`
  if (/supabase não configurado|variáveis de ambiente/i.test(source)) {
    return 'O servidor não está configurado no momento. Recarregue a página ou tente novamente mais tarde.'
  }
  if (/empresa criada, mas|não retornou o identificador|não foi possível concluir a configuração/i.test(source)) {
    return 'A empresa foi criada, mas faltou concluir uma etapa. Reabra a página da empresa e tente novamente.'
  }
  if (/usuário não autenticado|não há uma conta atual/i.test(source)) {
    return 'Entre novamente antes de continuar.'
  }
  if (/aguarde a sincronização|sincronização em andamento/i.test(source)) {
    return 'A sincronização ainda está em andamento. Aguarde alguns segundos e tente sair novamente.'
  }
  if (/bucket.*not found|bucket.*does not exist|profile-photos.*does not exist/i.test(source)) {
    return 'Não foi possível abrir o armazenamento de fotos. Entre em contato com o suporte.'
  }
  if (/invalid_credentials|invalid login credentials/i.test(source)) return 'E-mail ou senha inválidos.'
  if (/email_not_confirmed|email not confirmed/i.test(source)) return 'Confirme seu e-mail antes de entrar.'
  if (/signup_disabled/i.test(source)) return 'Cadastros por e-mail estão temporariamente desativados.'
  if (/too_many_requests|429/.test(source)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (/user already registered|already registered|email.*already.*exist/i.test(source)) return 'Já existe uma conta com este e-mail.'
  if (/password.*at least|password.*weak|senha.*mínimo/i.test(source)) return 'A senha deve ter pelo menos 6 caracteres.'
  if (/invalid email|email address.*invalid|email.*inválido/i.test(source)) return 'Informe um e-mail válido.'
  if (/jwt expired|session.*expired|sessão.*expirada/i.test(source)) return 'Sua sessão terminou. Entre novamente para continuar.'
  if (/invalid_grant|refresh_token/i.test(source)) return 'Não foi possível validar seu acesso. Entre novamente.'
  if (/23505|duplicate key|unique constraint|já existe|já cadastrad/i.test(source)) return 'Este item já está cadastrado. Confira o nome ou código.'
  if (/23503|foreign key|still referenced/i.test(source)) return 'Este item está em uso e não pode ser removido.'
  if (/22p02|invalid input syntax|invalid_uuid/i.test(source)) return 'Algum dado informado não é válido. Confira os campos e tente novamente.'
  if (/row-level security|permission denied|rls|not authorized|not permitted/i.test(source)) {
    return 'Você não tem permissão para concluir esta ação.'
  }
  if (/no published privacy policy|política.*não publicada/i.test(source)) return 'A política ainda não está disponível para aceite.'
  if (/PGRST116|cannot coerce|no rows|not found|não encontrada|não encontrado/i.test(source)) return 'O registro solicitado não foi encontrado.'
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
