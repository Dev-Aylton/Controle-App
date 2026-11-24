import { describe, expect, it } from 'vitest'
import { formatSupportFileSize, validateSupportDraft } from './supportRules'

describe('chat de suporte', () => {
  it('exige texto ou arquivo', () => {
    expect(validateSupportDraft({ body: '', attachmentName: null, attachmentSize: null })).toContain('Escreva')
  })

  it('aceita texto ou arquivo válido', () => {
    expect(validateSupportDraft({ body: 'Preciso de ajuda', attachmentName: null, attachmentSize: null })).toBeNull()
    expect(validateSupportDraft({ body: '', attachmentName: 'foto.jpg', attachmentSize: 1024 })).toBeNull()
  })

  it('limita tamanho e tamanho da mensagem', () => {
    expect(validateSupportDraft({ body: 'a'.repeat(4001), attachmentName: null, attachmentSize: null })).toContain('4000')
    expect(validateSupportDraft({ body: '', attachmentName: 'grande.zip', attachmentSize: 11 * 1024 * 1024 })).toContain('10 MB')
  })

  it('formata tamanho do arquivo em português', () => {
    expect(formatSupportFileSize(512)).toBe('512 B')
    expect(formatSupportFileSize(2048)).toBe('2 KB')
    expect(formatSupportFileSize(1536 * 1024)).toBe('1,5 MB')
  })
})
