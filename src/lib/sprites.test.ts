import { describe, expect, it } from 'vitest'
import { spriteCandidates, spriteUrl, toSpriteSlug } from './sprites'
import type { Pokemon } from '../data/types'

describe('sprites', () => {
  it('通常種はそのまま', () => {
    expect(toSpriteSlug('garchomp')).toBe('garchomp')
  })

  it('フォルム・メガを Showdown 形式に変換', () => {
    expect(toSpriteSlug('rotomwash')).toBe('rotom-wash')
    expect(toSpriteSlug('ninetalesalola')).toBe('ninetales-alola')
    expect(toSpriteSlug('garchompmega')).toBe('garchomp-mega')
    expect(toSpriteSlug('charizardmegax')).toBe('charizard-megax')
    expect(toSpriteSlug('taurospaldeablaze')).toBe('tauros-paldeablaze')
    expect(toSpriteSlug('kyuremblack')).toBe('kyurem-black')
    expect(toSpriteSlug('urshifurapidstrike')).toBe('urshifu-rapidstrike')
  })

  it('URLを生成', () => {
    expect(spriteUrl('rotomwash')).toBe(
      'https://play.pokemonshowdown.com/sprites/dex/rotom-wash.png',
    )
  })

  it('候補に dex / gen5 / 公式イラストを並べる', () => {
    const pokemon = {
      id: 'kyuremblack',
      name: 'ブラックキュレム',
      types: ['ドラゴン', 'こおり'],
      ability: { id: 'teravolt', name: 'テラボルテージ', affectsTypes: false },
      form: 'ブラック',
      sprite: 'kyurem-black',
      num: 646,
    } as Pokemon
    expect(spriteCandidates(pokemon)).toEqual([
      'https://play.pokemonshowdown.com/sprites/dex/kyurem-black.png',
      'https://play.pokemonshowdown.com/sprites/gen5/kyurem-black.png',
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/646.png',
    ])
  })
})
