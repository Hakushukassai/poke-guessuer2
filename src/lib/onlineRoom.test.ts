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
  })
})
