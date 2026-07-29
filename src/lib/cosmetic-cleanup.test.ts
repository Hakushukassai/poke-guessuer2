import { describe, expect, it } from 'vitest'
import national from '../data/pokemon-national.json'
import { pokemonIn } from './game'

describe('cosmetic cleanup', () => {
  it('データ上ピカチュウキャップ・デオキシス別フォルム・ポワルン天気は除外', () => {
    const ids = new Set(national.map((p) => p.id))
    expect(ids.has('pikachu')).toBe(true)
    expect(ids.has('pikachubelle')).toBe(false)
    expect(ids.has('pikachuworld')).toBe(false)
    expect(ids.has('deoxys')).toBe(true)
    expect(ids.has('deoxysattack')).toBe(false)
    expect(ids.has('castform')).toBe(true)
    expect(ids.has('castformsunny')).toBe(false)
    expect(national.find((p) => p.id === 'arceusice')?.name).toBe(
      'アルセウス(こおりタイプ)',
    )
    expect(national.some((p) => p.name === 'こおりタイプ')).toBe(false)
  })

  it('プレイ中プールにもデオキシス・ポワルンは1体、アルセウス表記は正しい', () => {
    const n = pokemonIn('national')
    expect(n.filter((p) => p.id.includes('deoxys')).map((p) => p.id)).toEqual([
      'deoxys',
    ])
    expect(n.filter((p) => p.id.includes('castform')).map((p) => p.id)).toEqual(
      ['castform'],
    )
    expect(n.find((p) => p.id === 'arceusice')?.name).toBe(
      'アルセウス(こおりタイプ)',
    )
    // タイプが違うロトム家電・メガXは残る
    expect(n.some((p) => p.id === 'rotomwash')).toBe(true)
    expect(n.some((p) => p.id === 'charizardmegax')).toBe(true)
    expect(n.some((p) => p.id === 'charizardmegay')).toBe(false)
  })
})
