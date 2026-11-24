export type SupportDraft = {
  body: string
  attachmentName: string | null
  attachmentSize: number | null
}

export function validateSupportDraft(draft: SupportDraft) {
  const body = draft.body.trim()
  if (!body && !draft.attachmentName) {
    return 'Escreva uma mensagem ou selecione um arquivo.'
  }
  if (body.length > 4000) {
    return 'A mensagem pode ter no máximo 4000 caracteres.'
  }
  if (draft.attachmentSize != null && draft.attachmentSize > 10 * 1024 * 1024) {
    return 'O arquivo pode ter no máximo 10 MB.'
  }
  return null
}

export function formatSupportFileSize(size: number | null) {
  if (!size || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
