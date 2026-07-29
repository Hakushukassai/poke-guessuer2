import competitiveData from '../data/competitive-champions.json'
import type { PlayerId, Pokemon } from '../data/types'

export type CompetitiveTraitId =
  | 'hazard_set'
  | 'hazard_ctrl'
  | 'setup'
  | 'recovery'
  | 'priority'
  | 'pivot'
  | 'knock_off'
  | 'encore'
  | 'taunt'
  | 'intimidate'
  | 'regenerator'
  | 'type_ability'
  | 'phys_atk'

export type CompetitiveStatId = 'speed' | 'bst'

export type CompetitiveTraitGroup = 'tools' | 'ability' | 'build'

export interface CompetitiveMeta {
  speed: number
  bst: number
  atk: number
  spa: number
  traits: Record<CompetitiveTraitId, boolean>
}

export interface CompetitiveTraitDef {
  id: CompetitiveTraitId
  /** Short chip title */
  label: string
  /** Full yes/no question shown on the button */
  question: string
  /** Concrete examples under the question */
  examples: string
  group: CompetitiveTraitGroup
}

/**
 * Askable traits only.
 * Broad "setup" / niche "encore" stay in data but are hidden —
 * too often-yes or too niche feels like noise in a first pass.
 */
export const COMPETITIVE_TRAITS: CompetitiveTraitDef[] = [
  {
    id: 'hazard_set',
    label: '設置',
    question: '設置技を覚える？',
    examples: 'ステロ・まきびし・ねばねばネット',
    group: 'tools',
  },
  {
    id: 'hazard_ctrl',
    label: '除去',
    question: '設置を払える？',
    examples: 'ぼうじん・スピーディスピン等',
    group: 'tools',
  },
  {
    id: 'recovery',
    label: '回復',
    question: '回復技がある？',
    examples: 'ねむる以外（じこさいせい・ねがいごと等）',
    group: 'tools',
  },
  {
    id: 'priority',
    label: '先制',
    question: '先制技がある？',
    examples: 'しんそく・アクジェ・すいりゅうれいが等',
    group: 'tools',
  },
  {
    id: 'pivot',
    label: '交代',
    question: '交代技で引ける？',
    examples: 'とんぼ・ボルチェン・フリターン等',
    group: 'tools',
  },
  {
    id: 'knock_off',
    label: 'はたき',
    question: 'はたきおとすを覚える？',
    examples: '持ち物を落とす定番技',
    group: 'tools',
  },
  {
    id: 'taunt',
    label: 'ちょうはつ',
    question: 'ちょうはつを覚える？',
    examples: '変化技封じ',
    group: 'tools',
  },
  {
    id: 'intimidate',
    label: 'いかく',
    question: 'いかくを持てる？',
    examples: '特性候補にいかくがある',
    group: 'ability',
  },
  {
    id: 'regenerator',
    label: '再生力',
    question: '再生力を持てる？',
    examples: '特性候補に再生力がある',
    group: 'ability',
  },
  {
    id: 'type_ability',
    label: '相性特性',
    question: '相性を変える特性を持てる？',
    examples: 'ふゆう・ちょすい・もらいび・そうしょく等',
    group: 'ability',
  },
  {
    id: 'phys_atk',
    label: '物理',
    question: '物理アタッカー寄り？',
    examples: '攻撃の種族値 ≥ 特攻',
    group: 'build',
  },
]

export const COMPETITIVE_TRAIT_GROUPS: {
  id: CompetitiveTraitGroup
  title: string
  blurb: string
}[] = [
  {
    id: 'tools',
    title: 'できること',
    blurb: '覚える技で枠を想像する',
  },
  {
    id: 'ability',
    title: '特性',
    blurb: '持てる特性かどうか',
  },
  {
    id: 'build',
    title: '型の匂い',
    blurb: '種族値の偏り',
  },
]

export const COMPETITIVE_STATS: {
  id: CompetitiveStatId
  label: string
  ask: string
}[] = [
  { id: 'speed', label: 'すばやさ', ask: 'このポケモンより速い？' },
  { id: 'bst', label: '種族値合計', ask: 'このポケモンより種族値が高い？' },
]

const META = competitiveData as Record<string, CompetitiveMeta>

export function getCompetitiveMeta(id: string): CompetitiveMeta | undefined {
  return META[id]
}

export interface TraitProbeRecord {
  by: PlayerId
  traitId: CompetitiveTraitId
  /** true = secret has the trait */
  hasTrait: boolean
}

export interface StatCompareRecord {
  by: PlayerId
  pivotId: string
  stat: CompetitiveStatId
  pivotValue: number
  /** true when secret.stat > pivotValue */
  greater: boolean
}

export function getTraitDef(
  id: CompetitiveTraitId,
): CompetitiveTraitDef | undefined {
  return COMPETITIVE_TRAITS.find((t) => t.id === id)
}

export function traitLabel(id: CompetitiveTraitId): string {
  return getTraitDef(id)?.label ?? id
}

export function traitQuestion(id: CompetitiveTraitId): string {
  return getTraitDef(id)?.question ?? traitLabel(id)
}

export function traitAnswerMark(hasTrait: boolean): string {
  return hasTrait ? '○' : '×'
}

export function traitAnswerWords(hasTrait: boolean): string {
  return hasTrait ? 'はい' : 'いいえ'
}

export function traitProbeLabel(probe: TraitProbeRecord): string {
  return `${traitQuestion(probe.traitId)} ${traitAnswerMark(probe.hasTrait)} ${traitAnswerWords(probe.hasTrait)}`
}

export function matchesTraitProbe(
  pokemon: Pokemon,
  probe: TraitProbeRecord,
): boolean {
  const meta = getCompetitiveMeta(pokemon.id)
  if (!meta) return false
  return Boolean(meta.traits[probe.traitId]) === probe.hasTrait
}

export function matchesStatCompare(
  pokemon: Pokemon,
  compare: StatCompareRecord,
): boolean {
  const meta = getCompetitiveMeta(pokemon.id)
  if (!meta) return false
  const value = meta[compare.stat]
  return compare.greater ? value > compare.pivotValue : value <= compare.pivotValue
}

export function statAsk(stat: CompetitiveStatId): string {
  return COMPETITIVE_STATS.find((s) => s.id === stat)?.ask ?? 'これより上？'
}

export function statCompareLabel(
  compare: StatCompareRecord,
  pivotName?: string,
): string {
  const name = pivotName?.trim() || `基準(${compare.pivotValue})`
  if (compare.stat === 'speed') {
    return compare.greater
      ? `${name}より速い`
      : `${name}と同じか遅い`
  }
  return compare.greater
    ? `${name}より種族値が高い`
    : `${name}と同じか種族値が低い`
}
