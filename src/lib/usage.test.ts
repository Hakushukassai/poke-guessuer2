import { describe, expect, it } from 'vitest'
import { pokemonIn } from './game'
import {
  COMMON_USAGE_THRESHOLD,
  filterAndSortCompetitivePick,
  getPokemonUsage,
  matchesRoleFilter,
  sortByUsageThenName,
  usageSource,
} from './usage'

describe('champions usage data', () => {
  it('Smogon Champions OU ソースがある', () => {
    const src = usageSource()
    expect(src.metagame).toContain('champions')
    expect(src.cutoff).toBe(1500)
    expect(src.label).toContain('Smogon')
  })

  it('ガブリアスなど主要種をカバーする', () => {
    const garchomp = getPokemonUsage('garchomp')
    expect(garchomp).toBeDefined()
    expect(garchomp!.usage).toBeGreaterThan(0.2)
    expect(garchomp!.rank).toBe(1)
    expect(garchomp!.roles).toContain('設置')
    expect(garchomp!.topMoves.some((m) => m.id === 'stealthrock')).toBe(true)

    expect(getPokemonUsage('corviknight')).toBeDefined()
    expect(getPokemonUsage('kingambit')).toBeDefined()
  })

  it('mausholdfour が Smogon Maushold に紐づく', () => {
    const m = getPokemonUsage('mausholdfour')
    expect(m).toBeDefined()
    expect(m!.usage).toBeGreaterThan(0)
    expect(m!.topMoves.length).toBeGreaterThan(0)
  })
})

describe('usage role filter / sort', () => {
  it('設置フィルタはステロ等の設置役だけ', () => {
    const roster = pokemonIn('champions', 'competitive')
    const hazards = filterAndSortCompetitivePick(roster, {
      query: '',
      typeFilter: '',
      roleFilter: '設置',
      isBanned: () => false,
    })
    expect(hazards.length).toBeGreaterThan(5)
    expect(hazards.every((p) => getPokemonUsage(p.id)?.roles.includes('設置'))).toBe(
      true,
    )
    expect(hazards.some((p) => p.id === 'garchomp')).toBe(true)
  })

  it('よく使うは使用率しきい値以上', () => {
    const entry = getPokemonUsage('garchomp')!
    expect(matchesRoleFilter(entry, '常用')).toBe(true)
    expect(matchesRoleFilter({ ...entry, usage: 0.01 }, '常用')).toBe(false)
    expect(COMMON_USAGE_THRESHOLD).toBe(0.05)
  })

  it('使用率順（同率は図鑑番号）', () => {
    const roster = pokemonIn('champions', 'competitive')
    const sorted = [...roster].sort(sortByUsageThenName)
    const top = sorted[0]
    expect(top.id).toBe('garchomp')
    const usages = sorted
      .map((p) => getPokemonUsage(p.id)?.usage ?? -1)
      .filter((u) => u >= 0)
    for (let i = 1; i < usages.length; i++) {
      expect(usages[i - 1]).toBeGreaterThanOrEqual(usages[i])
    }
  })

  it('タイプ相性モードの名簿は図鑑番号順', () => {
    const typeRoster = pokemonIn('champions', 'type')
    for (let i = 1; i < typeRoster.length; i++) {
      const prev = typeRoster[i - 1].num ?? Infinity
      const cur = typeRoster[i].num ?? Infinity
      expect(prev).toBeLessThanOrEqual(cur)
    }
  })
})
