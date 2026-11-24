import { describe, expect, it } from 'vitest'
import { shouldShowBackToTop } from './backToTopRules'

describe('BackToTop', () => {
  it('só aparece depois de rolagem longa o bastante', () => {
    expect(shouldShowBackToTop(700)).toBe(false)
    expect(shouldShowBackToTop(701)).toBe(true)
  })
})
