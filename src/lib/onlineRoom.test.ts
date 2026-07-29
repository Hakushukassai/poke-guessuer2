import { describe, expect, it } from 'vitest'
import {
  applyClientMessage,
  createOnlineRoom,
  toClientView,
} from './onlineRoom'

describe('onlineRoom', () => {
  it('2人が揃うと選出へ進む', () => {
    let s = createOnlineRoom('champions')
    s = applyClientMessage(s, 'c1', {
      type: 'claim',
      name: 'フマ',
      pool: 'national',
    }).state
    expect(s.seatIds.p1).toBe('c1')
    expect(s.pool).toBe('national')
    expect(s.phase).toBe('lobby')

    s = applyClientMessage(s, 'c2', { type: 'claim', name: 'ユウ' }).state
    expect(s.phase).toBe('picking')
    expect(s.names.p2).toBe('ユウ')
  })

  it('両方選出でバトル開始し、相手の選出は隠す', () => {
    let s = createOnlineRoom()
    s = applyClientMessage(s, 'c1', { type: 'claim', name: 'A' }).state
    s = applyClientMessage(s, 'c2', { type: 'claim', name: 'B' }).state
    s = applyClientMessage(s, 'c1', { type: 'pick', pokemonId: 'garchomp' }).state
    expect(s.phase).toBe('picking')

    const v1 = toClientView(s, 'p1')
    expect(v1.myPick).toBe('garchomp')
    expect(v1.opponentPicked).toBe(false)
    expect(v1.picks.p2).toBeNull()

    s = applyClientMessage(s, 'c2', { type: 'pick', pokemonId: 'rotomwash' }).state
    expect(s.phase).toBe('battle')

    const v2 = toClientView(s, 'p2')
    expect(v2.picks.p1).toBeNull()
    expect(v2.myPick).toBe('rotomwash')
    expect(v2.candidateCounts.p1).toBe(v2.rosterSize)
    expect(v2.candidateCounts.p2).toBe(v2.rosterSize)

    s = applyClientMessage(s, 'c1', {
      type: 'probe',
      moveType: 'こおり',
    }).state
    const after = toClientView(s, 'p2')
    expect(after.candidateCounts.p1).toBeLessThan(after.rosterSize)
    expect(after.lastMessage).toMatch(/こおり/)
  })

  it('複合のみモードでは単タイプ選出を拒否し、複合なら対戦開始', () => {
    let s = createOnlineRoom('champions', 'type_dual')
    s = applyClientMessage(s, 'c1', {
      type: 'claim',
      name: 'A',
      quizMode: 'type_dual',
    }).state
    s = applyClientMessage(s, 'c2', { type: 'claim', name: 'B' }).state
    expect(s.quizMode).toBe('type_dual')

    const mono = applyClientMessage(s, 'c1', {
      type: 'pick',
      pokemonId: 'pikachu',
    })
    expect(mono.error).toMatch(/図鑑にいません/)
    expect(mono.state.picks.p1).toBeNull()

    s = applyClientMessage(s, 'c1', {
      type: 'pick',
      pokemonId: 'garchomp',
    }).state
    expect(s.picks.p1).toBe('garchomp')
    s = applyClientMessage(s, 'c2', {
      type: 'pick',
      pokemonId: 'rotomwash',
    }).state
    expect(s.phase).toBe('battle')
  })

  it('先攻正解で追い当て、両方正解なら引き分け', () => {
    let s = createOnlineRoom()
    s = applyClientMessage(s, 'c1', { type: 'claim' }).state
    s = applyClientMessage(s, 'c2', { type: 'claim' }).state
    s = applyClientMessage(s, 'c1', { type: 'pick', pokemonId: 'garchomp' }).state
    s = applyClientMessage(s, 'c2', { type: 'pick', pokemonId: 'rotomwash' }).state

    s = applyClientMessage(s, 'c1', { type: 'guess', pokemonId: 'rotomwash' }).state
    expect(s.phase).toBe('catchup')
    expect(s.currentPlayer).toBe('p2')

    s = applyClientMessage(s, 'c2', { type: 'guess', pokemonId: 'garchomp' }).state
    expect(s.phase).toBe('result')
    expect(s.draw).toBe(true)

    const revealed = toClientView(s, 'p1')
    expect(revealed.picks.p2).toBe('rotomwash')
    expect(revealed.picks.p1).toBe('garchomp')
  })

  it('リザルトでは両者の選出が揃って見える', () => {
    let s = createOnlineRoom()
    s = applyClientMessage(s, 'c1', { type: 'claim' }).state
    s = applyClientMessage(s, 'c2', { type: 'claim' }).state
    s = applyClientMessage(s, 'c1', { type: 'pick', pokemonId: 'garchomp' }).state
    s = applyClientMessage(s, 'c2', { type: 'pick', pokemonId: 'rotomwash' }).state
    // p1 が外して p2 が当てると即リザルト
    s = applyClientMessage(s, 'c1', {
      type: 'guess',
      pokemonId: 'garchomp',
    }).state
    s = applyClientMessage(s, 'c2', {
      type: 'guess',
      pokemonId: 'garchomp',
    }).state
    expect(s.phase).toBe('result')

    const forP1 = toClientView(s, 'p1')
    const forP2 = toClientView(s, 'p2')
    expect(forP1.picks).toEqual({ p1: 'garchomp', p2: 'rotomwash' })
    expect(forP2.picks).toEqual({ p1: 'garchomp', p2: 'rotomwash' })
  })
})
