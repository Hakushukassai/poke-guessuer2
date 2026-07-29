import usageData from '../data/champions-usage.json'
import type { Pokemon, PokemonType } from '../data/types'
import { getCompetitiveMeta } from './competitive'

export type UsageRole =
  | '設置'
  | '除去'
  | '積み'
  | 'サイクル'
  | '受け'
  | '先制'
  | '対面'

export type RoleFilter =
  | 'all'
  | '常用'
  | '設置'
  | '除去'
  | '積み'
  | 'サイクル'
  | '受け'

export interface UsageMove {
  id: string
  name: string
}

export interface UsageItem {
  id: string
  name: string
}

export interface PokemonUsage {
  usage: number
  rank: number
  topMoves: UsageMove[]
  topItem: UsageItem | null
  roles: UsageRole[]
  blurb: string
}

export interface UsageSource {
  metagame: string
  cutoff: number
  month: string
  battles: number | null
  label: string
}

const DATA = usageData as {
  source: UsageSource
  pokemon: Record<string, PokemonUsage>
}

/** Usage share at/above this counts as “よく使う” in the filter. */
export const COMMON_USAGE_THRESHOLD = 0.05

export const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: '常用', label: 'よく使う' },
  { id: '設置', label: '設置' },
  { id: '除去', label: '除去' },
  { id: '積み', label: '積み' },
  { id: 'サイクル', label: 'サイクル' },
  { id: '受け', label: '受け' },
  { id: 'all', label: '全部' },
]

export function usageSource(): UsageSource {
  return DATA.source
}

export function getPokemonUsage(id: string): PokemonUsage | undefined {
  return DATA.pokemon[id]
}

export function formatUsagePercent(usage: number | undefined): string {
  if (usage == null) return '圏外'
  return `環境 ${(usage * 100).toFixed(usage >= 0.1 ? 0 : 1)}%`
}

export function matchesRoleFilter(
  entry: PokemonUsage | undefined,
  filter: RoleFilter,
): boolean {
  if (filter === 'all') return true
  if (!entry) return false
  if (filter === '常用') return entry.usage >= COMMON_USAGE_THRESHOLD
  return entry.roles.includes(filter)
}

export function sortByUsageThenName(a: Pokemon, b: Pokemon): number {
  const ua = getPokemonUsage(a.id)?.usage ?? -1
  const ub = getPokemonUsage(b.id)?.usage ?? -1
  if (ub !== ua) return ub - ua
  const an = a.num ?? Number.POSITIVE_INFINITY
  const bn = b.num ?? Number.POSITIVE_INFINITY
  if (an !== bn) return an - bn
  return a.id.localeCompare(b.id)
}

export function filterAndSortCompetitivePick(
  roster: Pokemon[],
  opts: {
    query: string
    typeFilter: PokemonType | ''
    roleFilter: RoleFilter
    isBanned: (p: Pokemon) => boolean
  },
): Pokemon[] {
  const q = opts.query.trim()
  return roster
    .filter((p) => {
      if (opts.isBanned(p)) return false
      if (q && !p.name.includes(q)) return false
      if (opts.typeFilter && !p.types.includes(opts.typeFilter)) return false
      if (!matchesRoleFilter(getPokemonUsage(p.id), opts.roleFilter)) {
        return false
      }
      return true
    })
    .sort(sortByUsageThenName)
}

export function usageSpeedLine(id: string): string | null {
  const speed = getCompetitiveMeta(id)?.speed
  if (speed == null) return null
  return `すばやさ ${speed}`
}
