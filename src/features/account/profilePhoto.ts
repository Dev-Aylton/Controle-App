export type RemoveProfilePhotoDependencies = {
  removeStorageObject: (path: string) => Promise<void>
  clearProfilePhoto: (fields: { avatar_url: null; avatar_key: null }) => Promise<void>
  clearProviderAvatar: () => Promise<void>
}

export type RemoveProfilePhotoResult = {
  storageRemoved: boolean
  providerAvatarCleared: boolean
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
): Promise<RemoveProfilePhotoResult> {
  const storagePath = getOwnedProfilePhotoPath(userId, avatarUrl)
  await dependencies.clearProfilePhoto({ avatar_url: null, avatar_key: null })
  const result: RemoveProfilePhotoResult = {
    storageRemoved: !storagePath,
    providerAvatarCleared: !hasProviderAvatar,
  }
  if (storagePath) {
    try {
      await dependencies.removeStorageObject(storagePath)
      result.storageRemoved = true
    } catch {
      result.storageRemoved = false
    }
  }
  if (hasProviderAvatar) {
    try {
      await dependencies.clearProviderAvatar()
      result.providerAvatarCleared = true
    } catch {
      result.providerAvatarCleared = false
    }
  }
  return result
}
