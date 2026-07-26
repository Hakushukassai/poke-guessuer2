import evoIndex from '../data/evo-index.json'
import type { Pokemon, PokemonType } from '../data/types'
import { TYPES } from '../data/types'
import { calcEffectiveness } from './effectiveness'

type EvoNode = { prevo: string | null; evos: string[]; num?: number }
const EVO = evoIndex as Record<string, EvoNode>

/** Strip forme / mega suffixes to group related appearances. */
export function baseSpeciesKey(id: string): string {
  let s = id
  let prev = ''
  // cosmetic / alt formes that do not change the evo species identity
  const cosmetic = [
    [/blue$/, ''],
    [/yellow$/, ''],
    [/white$/, ''],
    [/orange$/, ''],
    [/green$/, ''],
    [/indigo$/, ''],
    [/violet$/, ''],
    [/gulping$/, ''],
    [/gorging$/, ''],
    [/droopy$/, ''],
    [/stretchy$/, ''],
    [/curly$/, ''],
    [/burn$/, ''],
    [/chill$/, ''],
    [/douse$/, ''],
    [/shock$/, ''],
    [/resolute$/, ''],
    [/bond$/, ''],
    [/ash$/, ''],
    [/meteor$/, ''],
    [/dada$/, ''],
    [/original$/, ''],
    [/lowkey$/, ''],
    [/complete$/, ''],
    [/10$/, ''],
    [/black$/, ''],
    // white already above
    [/crowned$/, ''],
    [/zen$/, ''],
    [/galarzen$/, 'galar'],
    [/rapidstrike$/, ''],
    [/singlestrike$/, ''],
    [/totem$/, ''],
    [/primal$/, ''],
    [/dawnwings$/, ''],
    [/duskmane$/, ''],
    [/ultra$/, ''],
    [/tera$/, ''],
    [/pompom$/, ''],
    [/pau$/, ''],
    [/sensu$/, ''],
    [/bloodmoon$/, ''],
    [/artisan$/, ''],
    [/masterpiece$/, ''],
    [/sandy$/, ''],
    [/trash$/, ''],
    [/pirouette$/, ''],
    [/eternamax$/, ''],
    [/unbound$/, ''],
    [/sky$/, ''],
    [/fancy$/, ''],
    [/pokeball$/, ''],
  ] as const

  while (s !== prev) {
    prev = s
    s = s
      .replace(/megax$/i, '')
      .replace(/megay$/i, '')
      .replace(/megaz$/i, '')
      .replace(/mega$/i, '')
      .replace(/alola$/i, '')
      .replace(/galar$/i, '')
      .replace(/hisui$/i, '')
      .replace(/paldeablaze$/i, '')
      .replace(/paldeaaqua$/i, '')
      .replace(/paldeacombat$/i, '')
      .replace(/paldea$/i, '')
      .replace(/wash$/i, '')
      .replace(/heat$/i, '')
      .replace(/frost$/i, '')
      .replace(/fan$/i, '')
      .replace(/mow$/i, '')
      .replace(/large$/i, '')
      .replace(/super$/i, '')
      .replace(/small$/i, '')
      .replace(/blade$/i, '')
      .replace(/shield$/i, '')
      .replace(/busted$/i, '')
      .replace(/hangry$/i, '')
      .replace(/masterpiece$/i, '')
      .replace(/therian$/i, '')
      .replace(/origin$/i, '')
      .replace(/wellspring$/i, '')
      .replace(/cornerstone$/i, '')
      .replace(/hearthflame$/i, '')

    for (const [re, rep] of cosmetic) {
      s = s.replace(re, rep)
    }
    s = s.replace(/female$/i, '').replace(/male$/i, '')
  }
  if (/f$/i.test(s) && s.length > 4) s = s.slice(0, -1)
  return s || id
}

/** Fingerprint of type effectiveness answers for all 18 types. */
export function effectivenessSignature(pokemon: Pokemon): string {
  return TYPES.map(
    (moveType) => calcEffectiveness(moveType as PokemonType, pokemon).label,
  ).join('|')
}

function preferenceScore(p: Pokemon): number {
  let score = 0
  const id = p.id.toLowerCase()
  if (!id.includes('mega')) score += 200
  if (!p.form) score += 80
  if (
    !/(alola|galar|hisui|paldea|wash|heat|frost|fan|mow|blade|busted|hangry|large|super|small|masterpiece|fancy|pokeball|totem|primal|therian)/.test(
      id,
    )
  ) {
    score += 40
  }
  if (!/[fm]$/.test(id) || id.endsWith('um') || id.endsWith('im')) score += 10
  score += Math.max(0, 50 - id.length)
  return score
}

/**
 * Keep only one Pokémon per (species family × effectiveness profile).
 * Mega / alternate forms appear only when types or type-affecting abilities
 * change the matchup answers.
 */
export function dedupeIndistinguishableForms(list: Pokemon[]): Pokemon[] {
  const byFamily = new Map<string, Pokemon[]>()
  for (const p of list) {
    const key = baseSpeciesKey(p.id)
    const group = byFamily.get(key)
    if (group) group.push(p)
    else byFamily.set(key, [p])
  }

  const kept: Pokemon[] = []
  for (const family of byFamily.values()) {
    const bestBySig = new Map<string, Pokemon>()
    for (const p of family) {
      const sig = effectivenessSignature(p)
      const current = bestBySig.get(sig)
      if (!current || preferenceScore(p) > preferenceScore(current)) {
        bestBySig.set(sig, p)
      }
    }
    kept.push(...bestBySig.values())
  }

  return kept.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

function chainRoot(speciesId: string): string {
  let cur = speciesId
  const seen = new Set<string>()
  while (EVO[cur]?.prevo && !seen.has(cur)) {
    seen.add(cur)
    cur = EVO[cur].prevo!
  }
  return cur
}

function chainSpeciesIds(root: string): string[] {
  const out: string[] = []
  const queue = [root]
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    for (const evo of EVO[id]?.evos ?? []) queue.push(evo)
  }
  return out
}

function isFinalSpecies(speciesId: string): boolean {
  const evos = EVO[speciesId]?.evos
  return !evos || evos.length === 0
}

/**
 * Keep final evolutions by default.
 * Pre-evolutions stay only when their type-effectiveness profile differs
 * from every final evolution in the same line (that exists in the pool).
 */
export function filterPreEvolutions(list: Pokemon[]): Pokemon[] {
  const bySpecies = new Map<string, Pokemon[]>()
  for (const p of list) {
    const species = baseSpeciesKey(p.id)
    const group = bySpecies.get(species)
    if (group) group.push(p)
    else bySpecies.set(species, [p])
  }

  const kept: Pokemon[] = []
  const visitedChains = new Set<string>()

  for (const species of bySpecies.keys()) {
    const root = chainRoot(species)
    if (visitedChains.has(root)) continue
    visitedChains.add(root)

    const chain = chainSpeciesIds(root)
    const finals = chain.filter(isFinalSpecies)
    const finalSigs = new Set<string>()
    for (const finalId of finals) {
      for (const p of bySpecies.get(finalId) ?? []) {
        finalSigs.add(effectivenessSignature(p))
      }
    }

    for (const speciesId of chain) {
      const members = bySpecies.get(speciesId)
      if (!members) continue
      const final = isFinalSpecies(speciesId)
      for (const p of members) {
        if (final) {
          kept.push(p)
          continue
        }
        // Pre-evo: keep only if matchup profile is unique vs finals in pool
        if (finalSigs.size === 0) {
          // no final in this dual-type pool — keep as playable
          kept.push(p)
          continue
        }
        const sig = effectivenessSignature(p)
        if (!finalSigs.has(sig)) kept.push(p)
      }
    }
  }

  return kept.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

/** Apply form-dedupe then pre-evolution filter. */
export function preparePool(list: Pokemon[]): Pokemon[] {
  const prepared = filterPreEvolutions(dedupeIndistinguishableForms(list))
  const byId = new Map<string, Pokemon>()
  for (const p of prepared) byId.set(p.id, p)
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}
