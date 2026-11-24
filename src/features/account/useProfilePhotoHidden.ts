import { useSyncExternalStore } from 'react'

const eventName = 'controle-app:profile-photo-removed'

function storageKey(userId: string) {
  return `controle-app:profile-photo-hidden:${userId}`
}

export function markProfilePhotoHidden(userId: string) {
  localStorage.setItem(storageKey(userId), 'true')
  window.dispatchEvent(new CustomEvent(eventName, { detail: { userId } }))
}

export function useProfilePhotoHidden(userId: string | null | undefined) {
  return useSyncExternalStore(
    (notify) => {
      const onChange = (event: Event) => {
        if ((event as CustomEvent<{ userId: string }>).detail?.userId === userId) notify()
      }
      window.addEventListener(eventName, onChange)
      return () => window.removeEventListener(eventName, onChange)
    },
    () => Boolean(userId && localStorage.getItem(storageKey(userId))),
    () => false,
  )
}
