import { describe, expect, it, vi } from 'vitest'
import { getOwnedProfilePhotoPath, removeProfilePhoto } from './profilePhoto'

describe('remoção da foto de perfil', () => {
  it('apaga apenas o objeto Storage do próprio usuário e limpa referências do perfil', async () => {
    const calls: string[] = []
    let updatedFields: { avatar_url: null; avatar_key: null } | null = null
    const result = await removeProfilePhoto('usuario-a', 'usuario-a/avatar.webp', true, {
      removeStorageObject: async (path) => { calls.push(`storage:${path}`) },
      clearProfilePhoto: async (fields) => { updatedFields = fields; calls.push('profile') },
      clearProviderAvatar: async () => { calls.push('provider') },
    })

    expect(calls).toEqual(['profile', 'storage:usuario-a/avatar.webp', 'provider'])
    expect(updatedFields).toEqual({ avatar_url: null, avatar_key: null })
    expect(result).toEqual({ storageRemoved: true, providerAvatarCleared: true })
  })

  it('limpa a foto do perfil mesmo quando o arquivo antigo não pode ser removido', async () => {
    const clearProfilePhoto = vi.fn(async () => undefined)
    const result = await removeProfilePhoto('usuario-a', 'usuario-a/avatar.webp', false, {
      clearProfilePhoto,
      clearProviderAvatar: async () => undefined,
      removeStorageObject: async () => { throw new Error('storage denied') },
    })
    expect(clearProfilePhoto).toHaveBeenCalledOnce()
    expect(result.storageRemoved).toBe(false)
  })

  it('não transforma falha da limpeza do Google em falha da remoção do perfil', async () => {
    const result = await removeProfilePhoto('usuario-a', '', true, {
      clearProfilePhoto: async () => undefined,
      clearProviderAvatar: async () => { throw new Error('provider rejected') },
      removeStorageObject: async () => undefined,
    })
    expect(result).toEqual({ storageRemoved: true, providerAvatarCleared: false })
  })

  it('não tenta apagar URL externa ou objeto pertencente a outro usuário', async () => {
    const removeStorageObject = vi.fn(async () => undefined)
    expect(getOwnedProfilePhotoPath('usuario-a', 'https://google.example/avatar.png')).toBeNull()
    expect(getOwnedProfilePhotoPath('usuario-a', 'usuario-b/avatar.webp')).toBeNull()
    await removeProfilePhoto('usuario-a', 'https://google.example/avatar.png', true, {
      removeStorageObject,
      clearProfilePhoto: async () => undefined,
      clearProviderAvatar: async () => undefined,
    })
    expect(removeStorageObject).not.toHaveBeenCalled()
  })
})
