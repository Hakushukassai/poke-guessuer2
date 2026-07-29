/**
 * Build competitive quiz metadata for the champions pool.
 *
 * Prerequisites:
 *   /tmp/pokedex.json   (Showdown)
 *   /tmp/learnsets.json (Showdown)
 *
 * Usage: node scripts/build-competitive-meta.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const dex = JSON.parse(fs.readFileSync('/tmp/pokedex.json', 'utf8'))
const learnsets = JSON.parse(fs.readFileSync('/tmp/learnsets.json', 'utf8'))
const champions = [
  ...JSON.parse(
    fs.readFileSync(path.join(root, 'src/data/pokemon-champions.json'), 'utf8'),
  ),
  ...JSON.parse(
    fs.readFileSync(
      path.join(root, 'src/data/pokemon-champions-mono.json'),
      'utf8',
    ),
  ),
]

/** @type {Record<string, string[]>} */
const MOVE_GROUPS = {
  hazard_set: [
    'stealthrock',
    'spikes',
    'toxicspikes',
    'stickyweb',
    'ceaselessedge',
    'stoneaxe',
  ],
  hazard_ctrl: [
    'defog',
    'rapidspin',
    'mortalspin',
    'tidyup',
    'courtchange',
  ],
  /** 本格積みのみ（わるあがき級の積みは除外） */
  setup: [
    'swordsdance',
    'nastyplot',
    'dragondance',
    'quiverdance',
    'calmmind',
    'bulkup',
    'coil',
    'shiftgear',
    'shellsmash',
    'tailglow',
    'geomancy',
    'victorydance',
    'clangoroussoul',
    'takeheart',
  ],
  recovery: [
    'recover',
    'softboiled',
    'roost',
    'moonlight',
    'morningsun',
    'synthesis',
    'shoreup',
    'healorder',
    'slackoff',
    'milkdrink',
    'wish',
    'strengthsap',
    'lunarblessing',
    'junglehealing',
  ],
  priority: [
    'aquajet',
    'bulletpunch',
    'extremespeed',
    'fakeout',
    'firstimpression',
    'iceshard',
    'machpunch',
    'shadowsneak',
    'suckerpunch',
    'vacuumwave',
    'watershuriken',
    'accelerock',
    'grassyglide',
    'jetpunch',
    'thunderclap',
  ],
  pivot: [
    'uturn',
    'voltswitch',
    'flipturn',
    'partingshot',
    'teleport',
    'chillyreception',
    'shedtail',
  ],
  knock_off: ['knockoff'],
  encore: ['encore'],
  taunt: ['taunt'],
}

const ABILITY_GROUPS = {
  intimidate: ['Intimidate'],
  regenerator: ['Regenerator'],
  type_ability: [
    'Levitate',
    'Water Absorb',
    'Dry Skin',
    'Storm Drain',
    'Volt Absorb',
    'Lightning Rod',
    'Motor Drive',
    'Flash Fire',
    'Well-Baked Body',
    'Sap Sipper',
    'Earth Eater',
    'Thick Fat',
    'Heatproof',
    'Water Bubble',
    'Fluffy',
    'Purifying Salt',
    'Filter',
    'Solid Rock',
    'Prism Armor',
    'Wonder Guard',
    'Bulletproof',
    'Soundproof',
  ],
}

function toId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function speciesLearnset(id) {
  const entry = learnsets[id]
  if (!entry?.learnset) return new Set()
  return new Set(Object.keys(entry.learnset))
}

/** Prefer base species learnset for formes when empty. */
function resolveLearnset(id) {
  let set = speciesLearnset(id)
  if (set.size > 0) return set
  const p = dex[id]
  if (p?.baseSpecies) {
    set = speciesLearnset(toId(p.baseSpecies))
    if (set.size > 0) return set
  }
  // strip common forme suffixes
  const stripped = id
    .replace(
      /(megax|megay|mega|alola|galar|hisui|paldeablaze|paldeaaqua|paldeacombat|origin|therian|wash|heat|frost|fan|mow|blade|busted|hangry|wellspring|cornerstone|hearthflame|crowned|rapidstrike|singlestrike)$/i,
      '',
    )
  if (stripped !== id) return speciesLearnset(stripped)
  return set
}

function abilityNames(id) {
  const p = dex[id]
  if (!p?.abilities) return []
  return Object.values(p.abilities).map(String)
}

function hasMoveGroup(learnset, group) {
  return group.some((m) => learnset.has(m))
}

function hasAbilityGroup(abilities, names) {
  const set = new Set(abilities)
  return names.some((n) => set.has(n))
}

function baseStatsOf(id) {
  const p = dex[id]
  if (p?.baseStats) return p.baseStats
  // try base species
  if (p?.baseSpecies) {
    const base = dex[toId(p.baseSpecies)]
    if (base?.baseStats) return base.baseStats
  }
  return null
}

const out = {}
const missing = []

for (const mon of champions) {
  const id = mon.id
  const stats = baseStatsOf(id)
  if (!stats) {
    missing.push(id)
    continue
  }
  const learnset = resolveLearnset(id)
  const abilities = abilityNames(id)
  const bst = stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe

  /** @type {Record<string, boolean>} */
  const traits = {}
  for (const [key, moves] of Object.entries(MOVE_GROUPS)) {
    traits[key] = hasMoveGroup(learnset, moves)
  }
  for (const [key, names] of Object.entries(ABILITY_GROUPS)) {
    traits[key] = hasAbilityGroup(abilities, names)
  }

  out[id] = {
    speed: stats.spe,
    bst,
    atk: stats.atk,
    spa: stats.spa,
    traits: {
      ...traits,
      phys_atk: stats.atk >= stats.spa,
    },
  }
}

fs.writeFileSync(
  path.join(root, 'src/data/competitive-champions.json'),
  JSON.stringify(out, null, 2) + '\n',
)

const traitKeys = [
  ...Object.keys(MOVE_GROUPS),
  ...Object.keys(ABILITY_GROUPS),
]
console.log('entries', Object.keys(out).length, 'missing', missing.length)
if (missing.length) console.log('missing', missing.slice(0, 20))
for (const key of traitKeys) {
  const n = Object.values(out).filter((e) => e.traits[key]).length
  console.log(`${key}: ${n}`)
}
