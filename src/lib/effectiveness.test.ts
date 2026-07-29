import { describe, expect, it } from 'vitest'
import { calcEffectiveness } from './effectiveness'
import type { Pokemon } from '../data/types'

function poke(
  types: [Pokemon['types'][0], Pokemon['types'][1]],
  ability: Pokemon['ability'],
): Pokemon {
  return { id: 'test', name: 'テスト', types: [...types], ability, form: null }
}

describe('calcEffectiveness', () => {
  it('ガブリアスへこおりはちょうばつぐん', () => {
    const garchomp = poke(['ドラゴン', 'じめん'], {
      id: 'sand_veil',
      name: 'すながくれ',
      affectsTypes: false,
    })
    expect(calcEffectiveness('こおり', garchomp).label).toBe('double_super')
    expect(calcEffectiveness('こおり', garchomp).multiplier).toBe(4)
  })

  it('ふゆうはじめん無効', () => {
    const flygon = poke(['じめん', 'ドラゴン'], {
      id: 'levitate',
      name: 'ふゆう',
      affectsTypes: true,
    })
    expect(calcEffectiveness('じめん', flygon).label).toBe('immune')
    expect(calcEffectiveness('じめん', flygon).multiplier).toBe(0)
  })

  it('ウォッシュロトムへでんきは等倍、じめんは無効', () => {
    const rotom = poke(['でんき', 'みず'], {
      id: 'levitate',
      name: 'ふゆう',
      affectsTypes: true,
    })
    expect(calcEffectiveness('でんき', rotom).label).toBe('neutral')
    expect(calcEffectiveness('じめん', rotom).label).toBe('immune')
    expect(calcEffectiveness('くさ', rotom).label).toBe('super')
  })

  it('あついしぼうはほのおとこおりを半減', () => {
    const apple = poke(['くさ', 'ドラゴン'], {
      id: 'thick_fat',
      name: 'あついしぼう',
      affectsTypes: true,
    })
    // ほのお vs くさ/ドラゴン = 2 * 0.5 = 1 → あついしぼうで 0.5
    expect(calcEffectiveness('ほのお', apple).multiplier).toBe(0.5)
    expect(calcEffectiveness('ほのお', apple).label).toBe('half')
    // こおり vs くさ/ドラゴン = 2 * 2 = 4 → あついしぼうで 2
    expect(calcEffectiveness('こおり', apple).multiplier).toBe(2)
    expect(calcEffectiveness('こおり', apple).label).toBe('super')
  })

  it('ミミッキュへはがねはばつぐん', () => {
    const mimikyu = poke(['ゴースト', 'フェアリー'], {
      id: 'disguise',
      name: 'ばけのかわ',
      affectsTypes: false,
    })
    expect(calcEffectiveness('はがね', mimikyu).label).toBe('super')
    expect(calcEffectiveness('ノーマル', mimikyu).label).toBe('immune')
  })

  it('フィルターはばつぐんを軽減してもばつぐんラベル', () => {
    const aggron = poke(['はがね', 'いわ'], {
      id: 'filter',
      name: 'フィルター',
      affectsTypes: true,
    })
    // fighting vs steel/rock = 2*2=4, filter 0.75 = 3 -> still super (not double)
    const result = calcEffectiveness('かくとう', aggron)
    expect(result.multiplier).toBe(3)
    expect(result.label).toBe('super')
  })
})
