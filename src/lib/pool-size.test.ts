import { describe, expect, it } from 'vitest'
import { poolCounts, pokemonIn } from './game'

describe('pool sizes', () => {
  it('進化・フォルム整理後の件数と日本語名', () => {
    const c = poolCounts()
    expect(c.champions).toBeGreaterThan(80)
    expect(c.champions).toBeLessThan(180)
    expect(c.national).toBeGreaterThan(200)
    expect(c.national).toBeLessThan(700)
    expect(c.national).toBeGreaterThan(c.champions)

    for (const pool of ['champions', 'national'] as const) {
      for (const p of pokemonIn(pool)) {
        expect(p.name.replace(/[XYZ]/g, '')).not.toMatch(/[A-Za-z]/)
        expect(p.sprite || p.id).toBeTruthy()
      }
    }
  })
})
