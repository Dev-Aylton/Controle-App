import { describe, expect, it } from 'vitest'
import { getPasswordInputType } from './passwordVisibility'

describe('visibilidade da senha', () => {
  it('oculta a senha por padrão', () => {
    expect(getPasswordInputType(false)).toBe('password')
  })

  it('exibe a senha quando solicitada', () => {
    expect(getPasswordInputType(true)).toBe('text')
  })
})
