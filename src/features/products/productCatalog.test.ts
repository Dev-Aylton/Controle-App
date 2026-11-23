import { describe, expect, it } from 'vitest'
import { searchProductCatalog } from './productCatalog'

describe('biblioteca inteligente de insumos', () => {
  it('sugere vodkas brasileiras por nome comum', () => {
    const results = searchProductCatalog('smirnoff')
    expect(results.some((item) => item.name === 'Smirnoff')).toBe(true)
    expect(results.some((item) => item.name === 'Smirnoff 1,5 L')).toBe(true)
  })

  it('preserva variantes iguais em volumes diferentes', () => {
    const smirnoff998 = searchProductCatalog('998')
    const smirnoff1500 = searchProductCatalog('1500')
    expect(smirnoff998[0]?.volumeMl).toBe(998)
    expect(smirnoff1500[0]?.volumeMl).toBe(1500)
  })

  it('sugere carnes e peixes usados em bares e restaurantes', () => {
    expect(searchProductCatalog('picanha').some((item) => item.category === 'Carnes')).toBe(true)
    expect(searchProductCatalog('espeto').some((item) => item.unit === 'porcao')).toBe(true)
    expect(searchProductCatalog('tilapia').some((item) => item.category === 'Peixes')).toBe(true)
  })

  it('remove duplicidades da mesma variante', () => {
    const results = searchProductCatalog('skol')
    const variants = results.map((item) => `${item.name}|${item.unit}|${item.volumeMl ?? ''}`)
    expect(new Set(variants).size).toBe(variants.length)
  })

  it('sugere vinhos tintos, brancos e rosés', () => {
    expect(searchProductCatalog('vinho tinto').some((item) => item.category === 'Vinhos tintos')).toBe(true)
    expect(searchProductCatalog('vinho branco').some((item) => item.category === 'Vinhos brancos')).toBe(true)
    expect(searchProductCatalog('rose').some((item) => item.category === 'Vinhos rosés')).toBe(true)
  })

  it('sugere espumantes nacionais e internacionais com variantes', () => {
    expect(searchProductCatalog('espumante').some((item) => item.category === 'Espumantes')).toBe(true)
    expect(searchProductCatalog('chandon').some((item) => item.volumeMl === 187)).toBe(true)
    expect(searchProductCatalog('prosecco').some((item) => item.name === 'Prosecco')).toBe(true)
  })

  it('sugere verduras, legumes e frutas', () => {
    expect(searchProductCatalog('alface').some((item) => item.category === 'Verduras')).toBe(true)
    expect(searchProductCatalog('cenoura').some((item) => item.category === 'Hortifruti')).toBe(true)
    expect(searchProductCatalog('banana').some((item) => item.unit === 'kg')).toBe(true)
  })

  it('sugere carnes, aves, peixes e espetinhos', () => {
    expect(searchProductCatalog('cupim').some((item) => item.category === 'Carnes')).toBe(true)
    expect(searchProductCatalog('asa de frango').some((item) => item.category === 'Aves')).toBe(true)
    expect(searchProductCatalog('robalo').some((item) => item.category === 'Peixes')).toBe(true)
    expect(searchProductCatalog('espeto de coracao').some((item) => item.unit === 'porcao')).toBe(true)
  })
})
