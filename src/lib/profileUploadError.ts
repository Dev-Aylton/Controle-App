export function profileUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/bucket|not found|does not exist/i.test(message)) {
    return 'O bucket profile-photos ainda não existe. Execute o patch 003-bucket-profile-photos.sql no Supabase.'
  }
  return null
}
