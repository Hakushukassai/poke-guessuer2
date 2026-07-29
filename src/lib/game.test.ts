import { describe, expect, it } from 'vitest'
import {
  POKEMON,
  filterCandidates,
  getPokemon,
  initialState,
  pokemonIn,
  reducer,
  type GameState,
} from './game'

function withPicks(state: GameState): GameState {
  return {
    ...state,
    phase: 'battle',
    picks: { p1: 'garchomp', p2: 'rotomwash' },
    currentPlayer: 'p1',
  }
}

describe('game reducer', () => {
  it('選出から対戦へ進む', () => {
    let s = reducer(initialState(), { type: 'START', pool: 'champions' })
    expect(s.phase).toBe('pick_p1')
    expect(s.names).toEqual({ p1: 'サトシ', p2: 'タケシ' })
    s = reducer(s, { type: 'PICK', pokemonId: 'garchomp' })
    expect(s.phase).toBe('handoff_p2')
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    expect(s.phase).toBe('pick_p2')
    s = reducer(s, { type: 'PICK', pokemonId: 'rotomwash' })
    expect(s.phase).toBe('handoff_battle')
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    expect(s.phase).toBe('battle')
    expect(s.currentPlayer).toBe('p1')
  })

  it('名前を入れるとそのまま使い、空ならデフォルト', () => {
    let s = reducer(initialState(), {
      type: 'START',
      pool: 'champions',
      names: { p1: 'フマ', p2: '  ' },
    })
    expect(s.names).toEqual({ p1: 'フマ', p2: 'タケシ' })
  })

  it('タイプ質問で履歴が付きターン交代', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'PROBE', moveType: 'こおり' })
    expect(s.probes).toHaveLength(1)
    // p1 probes against p2 = rotomwash. ice vs electric/water = 0.5
    expect(s.probes[0].result).toBe('half')
    expect(s.currentPlayer).toBe('p2')
  })

  it('図鑑比較で履歴が付きターン交代', () => {
    let s = withPicks(initialState())
    const pivot = getPokemon('garchomp')!
    // rotomwash num 479 > garchomp 445 → greater
    s = reducer(s, { type: 'DEX_COMPARE', pivotId: 'garchomp' })
    expect(s.dexCompares).toHaveLength(1)
    expect(s.dexCompares[0]).toMatchObject({
      by: 'p1',
      pivotId: 'garchomp',
      pivotNum: pivot.num,
      greater: true,
    })
    expect(s.lastMessage).toBe(`#${pivot.num}より大きい`)
    expect(s.currentPlayer).toBe('p2')
  })

  it('同じ基準への図鑑比較は無視', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'DEX_COMPARE', pivotId: 'garchomp' })
    s = { ...s, currentPlayer: 'p1' }
    const before = s.dexCompares.length
    s = reducer(s, { type: 'DEX_COMPARE', pivotId: 'garchomp' })
    expect(s.dexCompares).toHaveLength(before)
    expect(s.currentPlayer).toBe('p1')
  })

  it('先攻の正解は後攻の追い当てチャンスへ', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'GUESS', pokemonId: 'rotomwash' })
    expect(s.phase).toBe('handoff_catchup')
    expect(s.winner).toBeNull()
    expect(s.currentPlayer).toBe('p2')
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    expect(s.phase).toBe('catchup')
  })

  it('後攻も正解なら引き分け', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'GUESS', pokemonId: 'rotomwash' })
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    s = reducer(s, { type: 'GUESS', pokemonId: 'garchomp' })
    expect(s.phase).toBe('result')
    expect(s.draw).toBe(true)
    expect(s.winner).toBeNull()
  })

  it('後攻が外すと先攻の勝ち', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'GUESS', pokemonId: 'rotomwash' })
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    s = reducer(s, { type: 'GUESS', pokemonId: 'rotomwash' })
    expect(s.phase).toBe('result')
    expect(s.draw).toBe(false)
    expect(s.winner).toBe('p1')
  })

  it('後攻が通常ターンで正解したら後攻の勝ち', () => {
    let s = withPicks(initialState())
    s = { ...s, currentPlayer: 'p2' }
    s = reducer(s, { type: 'GUESS', pokemonId: 'garchomp' })
    expect(s.phase).toBe('result')
    expect(s.winner).toBe('p2')
    expect(s.draw).toBe(false)
  })

  it('不正解は候補除外して続行', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'GUESS', pokemonId: 'garchomp' })
    expect(s.phase).toBe('battle')
    expect(s.eliminated.p1).toContain('garchomp')
    expect(s.currentPlayer).toBe('p2')
  })

  it('選出前タイプバンで該当タイプが選出不可', () => {
    let s = reducer(initialState(), {
      type: 'START',
      pool: 'champions',
      options: { banEnabled: true },
    })
    expect(s.phase).toBe('ban_p1')
    s = reducer(s, { type: 'BAN', bannedType: 'ドラゴン' })
    expect(s.bannedTypes).toContain('ドラゴン')
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    expect(s.phase).toBe('ban_p2')
    s = reducer(s, { type: 'BAN', bannedType: 'みず' })
    s = reducer(s, { type: 'CONFIRM_HANDOFF' })
    expect(s.phase).toBe('pick_p1')
    s = reducer(s, { type: 'PICK', pokemonId: 'garchomp' })
    expect(s.phase).toBe('pick_p1')
    expect(s.picks.p1).toBeNull()
  })

  it('質問上限は指定した回数で制限される', () => {
    let s = withPicks(initialState())
    s = {
      ...s,
      options: { banEnabled: false, questionLimit: 2 },
    }
    s = reducer(s, { type: 'PROBE', moveType: 'こおり' })
    expect(s.probes).toHaveLength(1)
    s = { ...s, currentPlayer: 'p1' }
    s = reducer(s, { type: 'PROBE', moveType: 'ほのお' })
    expect(s.probes).toHaveLength(2)
    s = { ...s, currentPlayer: 'p1' }
    const before = s.probes.length
    s = reducer(s, { type: 'PROBE', moveType: 'くさ' })
    expect(s.probes).toHaveLength(before)
  })
})

describe('filterCandidates', () => {
  it('質問結果と矛盾する候補を除外', () => {
    let s = withPicks(initialState())
    s = reducer(s, { type: 'PROBE', moveType: 'じめん' })
    // rotomwash has levitate → immune to ground
    const candidates = filterCandidates(s, 'p1')
    expect(candidates.find((p) => p.id === 'rotomwash')).toBeTruthy()
    expect(candidates.find((p) => p.id === 'garchomp')).toBeFalsy()
    // じめん無効の結果なので、じめん等倍のガブリアスは除外される
    expect(candidates.length).toBeLessThan(POKEMON.length)
  })

  it('図鑑比較で番号帯を半分に絞る', () => {
    let s = withPicks(initialState())
    const before = filterCandidates(s, 'p1')
    const pivot = getPokemon('garchomp')!
    s = reducer(s, { type: 'DEX_COMPARE', pivotId: 'garchomp' })
    // after turn pass, filter as p1 still uses p1's compares
    const after = filterCandidates(s, 'p1')
    expect(after.length).toBeLessThan(before.length)
    expect(after.every((p) => (p.num ?? 0) > pivot.num!)).toBe(true)
    expect(after.find((p) => p.id === 'rotomwash')).toBeTruthy()
    expect(after.find((p) => p.id === 'garchomp')).toBeFalsy()
  })

  it('タイプ相性（全部）は単タイプを含み、複合のみモードは除外する', () => {
    expect(pokemonIn('champions', 'type').some((p) => p.types.length === 1)).toBe(
      true,
    )
    expect(pokemonIn('champions', 'type_dual').every((p) => p.types.length === 2)).toBe(
      true,
    )

    let allMode = reducer(initialState(), {
      type: 'START',
      pool: 'champions',
      quizMode: 'type',
    })
    allMode = reducer(allMode, { type: 'PICK', pokemonId: 'clefable' })
    expect(allMode.picks.p1).toBe('clefable')

    let dualMode = reducer(initialState(), {
      type: 'START',
      pool: 'champions',
      quizMode: 'type_dual',
    })
    dualMode = reducer(dualMode, { type: 'PICK', pokemonId: 'clefable' })
    expect(dualMode.picks.p1).toBeNull()
  })
})
