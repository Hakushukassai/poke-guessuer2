import typeChart from '../data/type-chart.json'
import typeAbilities from '../data/type-abilities.json'
import type {
  EffectivenessLabel,
  Pokemon,
  PokemonType,
} from '../data/types'

type ChartRow = Record<string, number>
type Chart = Record<string, ChartRow>

interface AbilityRule {
  name: string
  immunities?: string[]
  multipliers?: Record<string, number>
  superEffectiveModifier?: number
  wonderGuard?: boolean
}

const chart = typeChart as Chart
const abilities = typeAbilities as Record<string, AbilityRule>

export function baseEffectiveness(
  moveType: PokemonType,
  defTypes: readonly PokemonType[],
): number {
  const row = chart[moveType]
  if (!row) return 1
  return defTypes.reduce((mult, t) => mult * (row[t] ?? 1), 1)
}

export function applyAbility(
  base: number,
  moveType: PokemonType,
  abilityId: string | undefined,
): number {
  if (!abilityId) return base
  const rule = abilities[abilityId]
  if (!rule) return base

  if (rule.immunities?.includes(moveType)) return 0

  let result = base

  if (rule.multipliers?.[moveType] != null) {
    result *= rule.multipliers[moveType]
  }

  if (rule.superEffectiveModifier != null && result > 1) {
    result *= rule.superEffectiveModifier
  }

  if (rule.wonderGuard && result <= 1) {
    return 0
  }

  return result
}

export function toLabel(multiplier: number): EffectivenessLabel {
  if (multiplier === 0) return 'immune'
  if (multiplier <= 0.25) return 'quarter'
  if (multiplier < 1) return 'half'
  if (multiplier === 1) return 'neutral'
  if (multiplier >= 4) return 'double_super'
  if (multiplier > 1) return 'super'
  return 'neutral'
}

/** Map filter/solid rock style 1.5x etc. into nearest label bucket used by the game. */
export function toLabelFromFinal(multiplier: number): EffectivenessLabel {
  if (multiplier === 0) return 'immune'
  if (multiplier > 0 && multiplier <= 0.25) return 'quarter'
  if (multiplier > 0.25 && multiplier < 1) return 'half'
  if (multiplier === 1) return 'neutral'
  // 1.5 (filter on 2x) still reads as 抜群 for this deduction game
  if (multiplier > 1 && multiplier < 4) return 'super'
  if (multiplier >= 4) return 'double_super'
  return 'neutral'
}

export function calcEffectiveness(
  moveType: PokemonType,
  pokemon: Pick<Pokemon, 'types' | 'ability'>,
): { multiplier: number; label: EffectivenessLabel } {
  const base = baseEffectiveness(moveType, pokemon.types)
  const abilityId = pokemon.ability.affectsTypes ? pokemon.ability.id : undefined
  const multiplier = applyAbility(base, moveType, abilityId)
  return { multiplier, label: toLabelFromFinal(multiplier) }
}

export function matchesProbe(
  pokemon: Pokemon,
  moveType: PokemonType,
  expected: EffectivenessLabel,
): boolean {
  return calcEffectiveness(moveType, pokemon).label === expected
}
