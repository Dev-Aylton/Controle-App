type FocusTarget = Pick<HTMLElement, 'focus'>

export function focusFirstPrivacyPolicyDialogControl(controls: readonly FocusTarget[]) {
  controls[0]?.focus()
}

export function handlePrivacyPolicyDialogKeydown(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  activeElement: object | null,
  first: FocusTarget | null,
  last: FocusTarget | null,
  dismiss: () => void,
) {
  if (event.key === 'Escape') {
    dismiss()
    return
  }
  if (event.key !== 'Tab' || !first || !last) return
  if (event.shiftKey && activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
