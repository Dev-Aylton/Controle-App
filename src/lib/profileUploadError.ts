export function profileUploadErrorMessage(error: unknown) {
  const record = error as { message?: string; code?: string }
  const message = record.message ?? (error instanceof Error ? error.message : String(error))
  const source = `${record.code ?? ''} ${message}`
  if (/bucket|not found|does not exist/i.test(message)) {
    return 'Não foi possível acessar o armazenamento de fotos. Tente novamente mais tarde.'
  }
  if (/permission denied|row-level security|rls|not authorized/i.test(source)) {
    return 'Não foi possível alterar a foto. Confira o acesso da conta e tente novamente.'
  }
  return null
}
