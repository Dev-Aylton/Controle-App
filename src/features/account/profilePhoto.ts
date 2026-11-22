export type RemoveProfilePhotoDependencies = {
  removeStorageObject: (path: string) => Promise<void>
  clearProfilePhoto: (fields: { avatar_url: null; avatar_key: null }) => Promise<void>
  clearProviderAvatar: () => Promise<void>
}

export function getOwnedProfilePhotoPath(userId: string, avatarUrl: string): string | null {
  if (/^https?:/i.test(avatarUrl)) return null
  return avatarUrl.startsWith(`${userId}/`) ? avatarUrl : null
}

export async function removeProfilePhoto(
  userId: string,
  avatarUrl: string,
  hasProviderAvatar: boolean,
  dependencies: RemoveProfilePhotoDependencies,
) {
  const storagePath = getOwnedProfilePhotoPath(userId, avatarUrl)
  if (storagePath) await dependencies.removeStorageObject(storagePath)
  await dependencies.clearProfilePhoto({ avatar_url: null, avatar_key: null })
  if (hasProviderAvatar) await dependencies.clearProviderAvatar()
}
