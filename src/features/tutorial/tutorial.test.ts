import { describe, expect, it } from 'vitest'
import { dismissTutorial, getTutorialSteps, wasTutorialDismissed } from './tutorial'

describe('tutorial por cargo', () => {
  it('funcionário não recebe passos de gestão', () => {
    const text = getTutorialSteps('employee', false).map((step) => `${step.title} ${step.body}`).join(' ')
    expect(text).not.toContain('Auditoria')
    expect(text).not.toContain('Custo')
  })
  it('admin recebe modo suporte', () => {
    expect(getTutorialSteps(null, true)[0].body).toContain('suporte')
  })
  it('segue sem localStorage', () => {
    expect(() => dismissTutorial(null, 'employee')).not.toThrow()
    expect(wasTutorialDismissed(null, 'employee')).toBe(false)
  })
})
