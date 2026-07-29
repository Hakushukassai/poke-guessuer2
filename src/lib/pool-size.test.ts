import { describe, expect, it } from 'vitest'
import { POOL_ORDER, poolCounts, pokemonIn } from './game'

describe('pool sizes', () => {
  it('進化・フォルム整理後の件数と日本語名', () => {
    const c = poolCounts()
    const dual = poolCounts('type_dual')
    expect(c.champions).toBeGreaterThan(80)
    expect(c.champions).toBeLessThan(260)
    expect(c.champions).toBeGreaterThan(dual.champions)
    expect(c.national).toBeGreaterThan(800)
    expect(c.national).toBeLessThan(1000)
    expect(c.national).toBeGreaterThan(dual.national)
    expect(c.national).toBeGreaterThan(c.champions)

    expect(c.legendary).toBeGreaterThan(40)
    expect(c.legendary).toBeLessThan(c.national)
    expect(c.starters).toBeGreaterThan(15)
    expect(c.starters).toBeLessThan(80)
    expect(c.spooky).toBeGreaterThan(40)
    expect(c.spooky).toBeLessThan(c.national)

    for (const pool of POOL_ORDER) {
      expect(pokemonIn(pool).length).toBe(c[pool])
      for (const p of pokemonIn(pool)) {
        expect(p.name.length).toBeGreaterThan(0)
        expect(p.sprite || p.id).toBeTruthy()
      }
    }
  })

  it('お題パックの中身がテーマに沿う', () => {
    for (const p of pokemonIn('spooky')) {
      expect(p.types.includes('あく') || p.types.includes('ゴースト')).toBe(
        true,
      )
    }
    expect(pokemonIn('starters').some((p) => p.id === 'charizard')).toBe(true)
    expect(pokemonIn('legendary').some((p) => p.id.includes('rayquaza') || p.id === 'rayquaza')).toBe(
      true,
    )
  })
})
