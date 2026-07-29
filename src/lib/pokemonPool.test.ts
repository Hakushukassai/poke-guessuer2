import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../data/types'
import {
  baseSpeciesKey,
  dedupeIndistinguishableForms,
  effectivenessSignature,
  filterPreEvolutions,
  isFinalEvolution,
  preparePool,
} from './pokemonPool'

function poke(
  id: string,
  name: string,
  types: Pokemon['types'],
  ability: Pokemon['ability'],
  form: string | null = null,
): Pokemon {
  return { id, name, types, ability, form, sprite: id }
}

const none = {
  id: 'rough_skin',
  name: 'さめはだ',
  affectsTypes: false,
}

const levitate = {
  id: 'levitate',
  name: 'ふゆう',
  affectsTypes: true,
}

describe('pokemonPool', () => {
  it('baseSpeciesKey はメガやフォルムをまとめる', () => {
    expect(baseSpeciesKey('garchompmega')).toBe('garchomp')
    expect(baseSpeciesKey('rotomwash')).toBe('rotom')
    expect(baseSpeciesKey('charizardmegax')).toBe('charizard')
    expect(baseSpeciesKey('ninetalesalola')).toBe('ninetales')
    expect(baseSpeciesKey('gourgeistlarge')).toBe('gourgeist')
    expect(baseSpeciesKey('squawkabillyyellow')).toBe('squawkabilly')
    expect(baseSpeciesKey('cramorantgulping')).toBe('cramorant')
    expect(baseSpeciesKey('genesectburn')).toBe('genesect')
    expect(baseSpeciesKey('keldeoresolute')).toBe('keldeo')
    expect(baseSpeciesKey('zygarde10')).toBe('zygarde')
    expect(baseSpeciesKey('mausholdfour')).toBe('maushold')
    expect(baseSpeciesKey('palafinhero')).toBe('palafin')
  })

  it('最終進化判定', () => {
    expect(isFinalEvolution('bulbasaur')).toBe(false)
    expect(isFinalEvolution('ivysaur')).toBe(false)
    expect(isFinalEvolution('venusaur')).toBe(true)
    expect(isFinalEvolution('garchomp')).toBe(true)
    expect(isFinalEvolution('gabite')).toBe(false)
    expect(isFinalEvolution('mew')).toBe(true)
  })

  it('相性が同じメガは除外し、ベースを残す', () => {
    const list = dedupeIndistinguishableForms([
      poke('garchomp', 'ガブリアス', ['ドラゴン', 'じめん'], none),
      poke('garchompmega', 'メガガブリアス', ['ドラゴン', 'じめん'], none, 'メガ'),
    ])
    expect(list.map((p) => p.id)).toEqual(['garchomp'])
  })

  it('タイプが同じ見た目違いフォルムは1体にまとめる', () => {
    const list = dedupeIndistinguishableForms([
      poke('squawkabilly', 'イキリンコ', ['ノーマル', 'ひこう'], none),
      poke(
        'squawkabillyyellow',
        'イキリンコ',
        ['ノーマル', 'ひこう'],
        none,
        'イエロー',
      ),
      poke('cramorant', 'ウッウ', ['ひこう', 'みず'], none),
      poke(
        'cramorantgulping',
        'ウッウ',
        ['ひこう', 'みず'],
        none,
        'うのみ',
      ),
    ])
    expect(list.map((p) => p.id).sort()).toEqual(['cramorant', 'squawkabilly'])
  })

  it('タイプが変わるメガは残す', () => {
    const list = dedupeIndistinguishableForms([
      poke('charizard', 'リザードン', ['ほのお', 'ひこう'], none),
      poke(
        'charizardmegax',
        'メガリザードンX',
        ['ほのお', 'ドラゴン'],
        none,
        'メガ',
      ),
    ])
    expect(list.map((p) => p.id).sort()).toEqual([
      'charizard',
      'charizardmegax',
    ])
  })

  it('特性で相性が変わるフォルムは残す', () => {
    const list = dedupeIndistinguishableForms([
      poke('rotom', 'ロトム', ['でんき', 'ゴースト'], levitate),
      poke(
        'rotomwash',
        'ウォッシュロトム',
        ['でんき', 'みず'],
        levitate,
        'ウォッシュ',
      ),
    ])
    expect(list).toHaveLength(2)
    expect(
      effectivenessSignature(list[0]) === effectivenessSignature(list[1]),
    ).toBe(false)
  })

  it('別種族で相性が同じものは残す', () => {
    const list = dedupeIndistinguishableForms([
      poke('venusaur', 'フシギバナ', ['くさ', 'どく'], none),
      poke('victreebel', 'ウツボット', ['くさ', 'どく'], none),
    ])
    expect(list).toHaveLength(2)
  })

  it('進化前フィルタは相性が同じ進化前を落とせる（任意ユーティリティ）', () => {
    const list = filterPreEvolutions([
      poke('gabite', 'ガバイト', ['ドラゴン', 'じめん'], none),
      poke('garchomp', 'ガブリアス', ['ドラゴン', 'じめん'], none),
    ])
    expect(list.map((p) => p.id)).toEqual(['garchomp'])
  })

  it('進化でタイプ相性が変わるなら進化前も残す', () => {
    const list = filterPreEvolutions([
      poke('scyther', 'ストライク', ['むし', 'ひこう'], none),
      poke('scizor', 'ハッサム', ['むし', 'はがね'], none),
    ])
    expect(list.map((p) => p.id).sort()).toEqual(['scizor', 'scyther'])
  })

  it('preparePool は同相性メガを落とし、進化前は残す', () => {
    const list = preparePool([
      poke('gabite', 'ガバイト', ['ドラゴン', 'じめん'], none, null),
      poke('garchomp', 'ガブリアス', ['ドラゴン', 'じめん'], none, null),
      poke('garchompmega', 'メガガブリアス', ['ドラゴン', 'じめん'], none, 'メガ'),
    ].map((p, i) => ({ ...p, num: 443 + i })))
    expect(list.map((p) => p.id).sort()).toEqual(['gabite', 'garchomp'])
  })

  it('オーガポンのテラスタルは除外し、めんフォルムを残す', () => {
    const waterAbsorb = {
      id: 'water_absorb',
      name: 'ちょすい',
      affectsTypes: true,
    }
    const embody = {
      id: 'embody_aspect_wellspring_',
      name: 'Embody Aspect',
      affectsTypes: false,
    }
    const list = preparePool([
      poke(
        'ogerponwellspring',
        'オーガポン(いどのめん)',
        ['くさ', 'みず'],
        waterAbsorb,
        'Wellspring',
      ),
      poke(
        'ogerponwellspringtera',
        'オーガポン(いどのめん・テラスタル)',
        ['くさ', 'みず'],
        embody,
        'Wellspring-Tera',
      ),
    ])
    expect(list.map((p) => p.id)).toEqual(['ogerponwellspring'])
  })
})
