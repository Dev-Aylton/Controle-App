export function friendlySupabaseError(error: unknown) {
  const record = error as { message?: string; code?: string; status?: number }
  const message = record.message ?? (error instanceof Error ? error.message : String(error))
  const code = record.code ?? ''
  if (/invalid_credentials|invalid login credentials/i.test(`${code} ${message}`)) {
    return 'E-mail ou senha inválidos.'
  }
  if (/email_not_confirmed|email not confirmed/i.test(`${code} ${message}`)) {
    return 'Confirme seu e-mail antes de entrar.'
  }
  if (/signup_disabled/i.test(`${code} ${message}`)) {
    return 'Cadastros por e-mail estão temporariamente desativados.'
  }
  if (/too_many_requests|429/.test(`${code} ${message} ${record.status ?? ''}`)) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }
  if (/permission denied|row-level security|rls|not authorized/i.test(message)) {
    return 'Você não tem permissão para esta ação.'
  }
  if (/network|failed to fetch|fetch|timeout/i.test(message)) {
    return 'Não foi possível conectar ao Supabase. Verifique sua internet.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'E-mail ou senha inválidos.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirme seu e-mail antes de entrar.'
  }
  return message || 'Ocorreu um erro inesperado.'
}
