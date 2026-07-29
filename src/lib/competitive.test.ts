import { describe, expect, it } from 'vitest'
import {
  getCompetitiveMeta,
  matchesTraitProbe,
  matchesStatCompare,
} from './competitive'
import {
  filterCandidates,
  getPokemon,
  initialState,
  pokemonIn,
  reducer,
  type GameState,
} from './game'

function withCompetitiveBattle(state: GameState): GameState {
  return {
    ...state,
    quizMode: 'competitive',
    pool: 'champions',
    phase: 'battle',
    picks: { p1: 'garchomp', p2: 'skarmory' },
    currentPlayer: 'p1',
  }
}

describe('competitive mode', () => {
  it('チャンピオンズに対戦メタがある', () => {
    expect(getCompetitiveMeta('garchomp')?.speed).toBe(102)
    expect(getCompetitiveMeta('garchomp')?.traits.phys_atk).toBe(true)
    expect(getCompetitiveMeta('skarmory')?.traits.hazard_set).toBe(true)
  })

  it('対戦推理だけ単タイプを含む', () => {
    const typePool = pokemonIn('champions', 'type')
    const compPool = pokemonIn('champions', 'competitive')
    expect(typePool.every((p) => p.types.length === 2)).toBe(true)
    expect(compPool.some((p) => p.types.length === 1)).toBe(true)
    expect(compPool.length).toBeGreaterThan(typePool.length)
    expect(getPokemon('clefable', 'champions', 'competitive')?.types).toEqual([
      'フェアリー',
    ])
    expect(getPokemon('clefable', 'champions', 'type')).toBeUndefined()
  })

  it('イッカネズミは4ひきかぞくのみ', () => {
    const compPool = pokemonIn('champions', 'competitive')
    const maus = compPool.filter(
      (p) => p.id.includes('maushold') || p.name.includes('イッカネズミ'),
    )
    expect(maus.map((p) => p.id)).toEqual(['mausholdfour'])
    expect(maus[0]?.name).toContain('4ひき')
    expect(getPokemon('maushold', 'champions', 'competitive')).toBeUndefined()
    expect(getCompetitiveMeta('mausholdfour')?.traits).toBeTruthy()
    expect(getCompetitiveMeta('maushold')).toBeUndefined()
  })

  it('対戦推理スタートはチャンピオンズ固定', () => {
    const s = reducer(initialState(), {
      type: 'START',
      pool: 'national',
      quizMode: 'competitive',
    })
    expect(s.quizMode).toBe('competitive')
    expect(s.pool).toBe('champions')
  })

  it('特徴質問で候補が絞れる', () => {
    let s = withCompetitiveBattle(initialState())
    // skarmory has hazard_set
    s = reducer(s, { type: 'TRAIT_PROBE', traitId: 'hazard_set' })
    expect(s.traitProbes).toHaveLength(1)
    expect(s.traitProbes[0].hasTrait).toBe(true)
    expect(s.currentPlayer).toBe('p2')

    const left = filterCandidates(s, 'p1')
    expect(left.every((p) => getCompetitiveMeta(p.id)?.traits.hazard_set)).toBe(
      true,
    )
    expect(left.some((p) => p.id === 'skarmory')).toBe(true)
    expect(left.some((p) => p.id === 'primarina')).toBe(false)
  })

  it('すばやさ比較で候補が絞れる', () => {
    let s = withCompetitiveBattle(initialState())
    // pivot garchomp S102; skarmory is slower
    s = reducer(s, { type: 'STAT_COMPARE', pivotId: 'garchomp', stat: 'speed' })
    expect(s.statCompares[0].greater).toBe(false)
    const left = filterCandidates(s, 'p1')
    expect(
      left.every((p) => (getCompetitiveMeta(p.id)?.speed ?? 999) <= 102),
    ).toBe(true)
  })

  it('単タイプも選出・特徴質問できる', () => {
    let s = reducer(initialState(), {
      type: 'START',
      pool: 'champions',
      quizMode: 'competitive',
    })
    s = reducer(s, { type: 'PICK', pokemonId: 'garchomp' })
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    s = reducer(s, { type: 'PICK', pokemonId: 'clefable' })
    expect(s.picks.p2).toBe('clefable')
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    expect(s.phase).toBe('battle')
    s = reducer(s, { type: 'TRAIT_PROBE', traitId: 'recovery' })
    expect(s.traitProbes[0].hasTrait).toBe(true)
    expect(
      filterCandidates(s, 'p1').every(
        (p) => getCompetitiveMeta(p.id)?.traits.recovery,
      ),
    ).toBe(true)
  })

  it('matches helpers はメタ欠落を落とす', () => {
    const fake = {
      id: 'missingno',
      name: '欠番',
      types: ['ノーマル', 'ひこう'],
      ability: { id: 'x', name: 'x', affectsTypes: false },
      form: null,
    }
    expect(
      matchesTraitProbe(fake, {
        by: 'p1',
        traitId: 'setup',
        hasTrait: true,
      }),
    ).toBe(false)
    expect(
      matchesStatCompare(fake, {
        by: 'p1',
        pivotId: 'garchomp',
        stat: 'speed',
        pivotValue: 100,
        greater: true,
      }),
    ).toBe(false)
  })
})
