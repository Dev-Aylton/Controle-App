export function buildConfirmDescription(action: string, requiredText?: string) {
  return requiredText
    ? `Confirme ${action} digitando ${requiredText}.`
    : `Confirme ${action}.`
}
