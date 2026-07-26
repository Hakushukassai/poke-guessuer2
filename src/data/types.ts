export const TYPES = [
  'ノーマル',
  'ほのお',
  'みず',
  'でんき',
  'くさ',
  'こおり',
  'かくとう',
  'どく',
  'じめん',
  'ひこう',
  'エスパー',
  'むし',
  'いわ',
  'ゴースト',
  'ドラゴン',
  'あく',
  'はがね',
  'フェアリー',
] as const

export type PokemonType = (typeof TYPES)[number]

export type EffectivenessLabel =
  | 'immune'
  | 'quarter'
  | 'half'
  | 'neutral'
  | 'super'
  | 'double_super'

export const EFFECTIVENESS_LABEL_JA: Record<EffectivenessLabel, string> = {
  immune: '無効',
  quarter: 'かなりいまひとつ',
  half: 'いまひとつ',
  neutral: '等倍',
  super: 'ばつぐん',
  double_super: 'ちょうばつぐん',
}

export interface PokemonAbility {
  id: string
  name: string
  affectsTypes: boolean
}

export interface Pokemon {
  id: string
  name: string
  types: [PokemonType, PokemonType]
  ability: PokemonAbility
  form: string | null
  /** Showdown dex sprite slug when known */
  sprite?: string
  /** National dex number for artwork fallback */
  num?: number
}

export type PlayerId = 'p1' | 'p2'

export interface ProbeRecord {
  by: PlayerId
  moveType: PokemonType
  result: EffectivenessLabel
}

/** Ask whether the secret's dex number is greater than the pivot's. */
export interface DexCompareRecord {
  by: PlayerId
  pivotId: string
  pivotNum: number
  /** true when secret.num > pivotNum; false when secret.num <= pivotNum */
  greater: boolean
}

export interface GuessRecord {
  by: PlayerId
  pokemonId: string
  correct: boolean
}
