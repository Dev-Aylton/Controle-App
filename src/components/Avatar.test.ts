import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('usa o avatar masculino como padrão quando não há foto', () => {
    const markup = renderToStaticMarkup(createElement(Avatar, { name: 'Aylton' }))
    expect(markup).toContain('/Controle-App/avatars/default_avatar.jpg')
  })

  it('mantém o avatar feminino quando escolhido', () => {
    const markup = renderToStaticMarkup(createElement(Avatar, { avatarKey: 'default-female' }))
    expect(markup).toContain('/Controle-App/avatars/default_avatar_fem.jpg')
  })
})
