/**
 * Build mono-type Champions entries for competitive quiz mode.
 *
 * Prerequisites:
 *   /tmp/champs/pokemon.json
 *   /tmp/champs/abilities.json
 *   /tmp/pokedex.json (optional, for num / forme)
 *
 * Usage: node scripts/build-champions-mono.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { abilityNameJa } from './ability-ja.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const pokePath = process.argv[2] || '/tmp/champs/pokemon.json'
const ablPath = process.argv[3] || '/tmp/champs/abilities.json'

const TYPE_EN_TO_JA = {
  Normal: 'ノーマル',
  Fire: 'ほのお',
  Water: 'みず',
  Electric: 'でんき',
  Grass: 'くさ',
  Ice: 'こおり',
  Fighting: 'かくとう',
  Poison: 'どく',
  Ground: 'じめん',
  Flying: 'ひこう',
  Psychic: 'エスパー',
  Bug: 'むし',
  Rock: 'いわ',
  Ghost: 'ゴースト',
  Dragon: 'ドラゴン',
  Dark: 'あく',
  Steel: 'はがね',
  Fairy: 'フェアリー',
}

const TYPE_ABILITY = {
  Levitate: { id: 'levitate', name: 'ふゆう' },
  'Water Absorb': { id: 'water_absorb', name: 'ちょすい' },
  'Dry Skin': { id: 'dry_skin', name: 'かんそうはだ' },
  'Storm Drain': { id: 'storm_drain', name: 'よびみず' },
  'Volt Absorb': { id: 'volt_absorb', name: 'ちくでん' },
  'Lightning Rod': { id: 'lightning_rod', name: 'ひらいしん' },
  'Motor Drive': { id: 'motor_drive', name: 'でんきエンジン' },
  'Flash Fire': { id: 'flash_fire', name: 'もらいび' },
  'Well-Baked Body': { id: 'well_baked_body', name: 'よくやけるからだ' },
  'Sap Sipper': { id: 'sap_sipper', name: 'そうしょく' },
  'Earth Eater': { id: 'earth_eater', name: 'どしょく' },
  'Thick Fat': { id: 'thick_fat', name: 'あついしぼう' },
  Heatproof: { id: 'heatproof', name: 'たいねつ' },
  'Water Bubble': { id: 'water_bubble', name: 'すいほう' },
  Fluffy: { id: 'fluffy', name: 'もふもふ' },
  'Purifying Salt': { id: 'purifying_salt', name: 'きよめのしお' },
  Filter: { id: 'filter', name: 'フィルター' },
  'Solid Rock': { id: 'solid_rock', name: 'ハードロック' },
  'Prism Armor': { id: 'prism_armor', name: 'プリズムアーマー' },
  'Wonder Guard': { id: 'wonder_guard', name: 'ふしぎなまもり' },
  Eelevate: { id: 'eelevate', name: 'うなぎのぼり' },
}

/** Prefer these when present (after type-affecting abilities). */
const COMPETITIVE_ABILITY_PRIORITY = [
  'Technician',
  'Regenerator',
  'Intimidate',
  'Huge Power',
  'Pure Power',
  'Beast Boost',
  'Protosynthesis',
  'Quark Drive',
  'Supreme Overlord',
  'Orichalcum Pulse',
  'Hadron Engine',
  'Zero to Hero',
]

/** Mid-battle / cosmetic / redundant formes to skip. */
const SKIP_IDS = new Set([
  'maushold', // keep mausholdfour (4ひきかぞく) only
  'palafinhero', // battle transform of palafin
  'meowsticf', // identical competitive profile to male
  'meowsticfmega',
  'polteageistantique', // learnset-identical to base for our traits
])

const SKIP_NAME = /ポワルン|メタモン|ぬし|メガフラエッテ/

const poke = JSON.parse(fs.readFileSync(pokePath, 'utf8'))
const abl = JSON.parse(fs.readFileSync(ablPath, 'utf8'))
const ablByName = Object.fromEntries(
  (Array.isArray(abl) ? abl : Object.values(abl)).map((a) => [a.name, a]),
)

let dex = {}
try {
  dex = JSON.parse(fs.readFileSync('/tmp/pokedex.json', 'utf8'))
} catch {
  dex = {}
}

function abilityEntry(name) {
  const typed = TYPE_ABILITY[name]
  const a = ablByName[name]
  if (typed) {
    return {
      id: typed.id,
      name: a?.nameJa || typed.name,
      affectsTypes: true,
    }
  }
  const id = a?.id || String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return {
    id,
    name: a?.nameJa || abilityNameJa(id, name),
    affectsTypes: false,
  }
}

function pickAbility(abilities) {
  const list = abilities || []
  for (const name of list) {
    if (TYPE_ABILITY[name]) return abilityEntry(name)
  }
  for (const pref of COMPETITIVE_ABILITY_PRIORITY) {
    if (list.includes(pref)) return abilityEntry(pref)
  }
  if (list[0]) return abilityEntry(list[0])
  return { id: 'unknown', name: '不明', affectsTypes: false }
}

/** Align with dual champions: English Showdown forme, or null for base. */
function resolveForm(id, p) {
  const d = dex[id]
  if (d?.forme) return String(d.forme)
  if (p.baseSpecies) {
    // fallback: strip base ja name wrappers if needed
    return p.forme || p.form || 'Alt'
  }
  return null
}

function toSpriteSlug(id) {
  if (id.endsWith('megax')) return `${id.slice(0, -5)}-megax`
  if (id.endsWith('megay')) return `${id.slice(0, -5)}-megay`
  if (id.endsWith('mega')) return `${id.slice(0, -4)}-mega`
  if (id.endsWith('four')) return `${id.slice(0, -4)}-four`
  if (id.endsWith('hero')) return `${id.slice(0, -4)}-hero`
  if (id.endsWith('antique')) return `${id.slice(0, -7)}-antique`
  if (id.endsWith('paldeacombat')) return `${id.slice(0, -12)}-paldeacombat`
  if (id.endsWith('f') && id.length > 5) return `${id.slice(0, -1)}-f`
  return id
}

const arr = Array.isArray(poke) ? poke : Object.values(poke)

const mono = arr
  .filter((p) => p.types?.length === 1)
  .filter((p) => TYPE_EN_TO_JA[p.types[0]])
  .filter((p) => !SKIP_IDS.has(p.id))
  .filter((p) => {
    const ja = p.nameJa || p.name || ''
    return !SKIP_NAME.test(ja)
  })
  .map((p) => {
    const d = dex[p.id]
    return {
      id: p.id,
      name: p.nameJa || p.name,
      types: [TYPE_EN_TO_JA[p.types[0]]],
      ability: pickAbility(p.abilities),
      form: resolveForm(p.id, p),
      sprite: toSpriteSlug(p.id),
      num: d?.num ?? undefined,
    }
  })
  .sort((a, b) => (a.num ?? 0) - (b.num ?? 0) || a.id.localeCompare(b.id))

const out = path.join(root, 'src/data/pokemon-champions-mono.json')
fs.writeFileSync(out, JSON.stringify(mono, null, 2) + '\n')

const maus = mono.filter((p) => p.id.includes('maushold'))
console.log(`Wrote ${mono.length} mono-type Champions → ${out}`)
console.log(
  'maushold entries:',
  maus.map((p) => `${p.id}/${p.name}/${p.ability.name}`).join(' · ') || '(none)',
)
console.log(mono.slice(0, 10).map((p) => `${p.name}(${p.types[0]})`).join(' · '))
