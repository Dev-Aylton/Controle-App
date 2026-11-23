import { describe, expect, it } from 'vitest'
import { profileUploadErrorMessage } from './profileUploadError'

describe('mensagens de foto de perfil', () => {
  it('orienta a aplicar o patch do bucket', () => {
    expect(profileUploadErrorMessage(new Error('Bucket not found'))).toContain('Não foi possível acessar o armazenamento de fotos')
  })

  it('explica falha de RLS sem mostrar uma mensagem técnica', () => {
    expect(profileUploadErrorMessage(new Error('permission denied for table profiles')))
      .toBe('Não foi possível alterar a foto. Confira o acesso da conta e tente novamente.')
  })

  it('mantém o fallback para outro tipo de erro', () => {
    expect(profileUploadErrorMessage(new Error('Erro desconhecido'))).toBeNull()
  })
})
