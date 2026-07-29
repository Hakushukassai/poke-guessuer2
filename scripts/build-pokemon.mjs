/**
 * Regenerate src/data/pokemon.json from Champions source data.
 * Usage: node scripts/build-pokemon.mjs /path/to/champions/pokemon.json /path/to/champions/abilities.json
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

const TYPE_ABILITY_IDS = {
  Levitate: 'levitate',
  'Water Absorb': 'water_absorb',
  'Dry Skin': 'dry_skin',
  'Storm Drain': 'storm_drain',
  'Volt Absorb': 'volt_absorb',
  'Lightning Rod': 'lightning_rod',
  'Motor Drive': 'motor_drive',
  'Flash Fire': 'flash_fire',
  'Well-Baked Body': 'well_baked_body',
  'Sap Sipper': 'sap_sipper',
  'Earth Eater': 'earth_eater',
  'Thick Fat': 'thick_fat',
  Heatproof: 'heatproof',
  'Water Bubble': 'water_bubble',
  Fluffy: 'fluffy',
  'Purifying Salt': 'purifying_salt',
  Filter: 'filter',
  'Solid Rock': 'solid_rock',
  'Prism Armor': 'prism_armor',
  'Wonder Guard': 'wonder_guard',
  Eelevate: 'eelevate',
}

const poke = JSON.parse(fs.readFileSync(pokePath, 'utf8'))
const abl = JSON.parse(fs.readFileSync(ablPath, 'utf8'))
const ablByName = Object.fromEntries(
  (Array.isArray(abl) ? abl : Object.values(abl)).map((a) => [a.name, a]),
)

function pickAbility(abilities) {
  for (const name of abilities) {
    if (TYPE_ABILITY_IDS[name]) {
      const a = ablByName[name]
      return {
        id: TYPE_ABILITY_IDS[name],
        name: a?.nameJa || name,
        affectsTypes: true,
      }
    }
  }
  const first = abilities[0]
  const a = ablByName[first]
  const id = a?.id || first.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return {
    id,
    name: a?.nameJa || abilityNameJa(id, first),
    affectsTypes: false,
  }
}

const arr = Array.isArray(poke) ? poke : Object.values(poke)
const pokemon = arr
  .filter((p) => p.types?.length === 2)
  .map((p) => ({
    id: p.id,
    name: p.nameJa || p.name,
    types: p.types.map((t) => TYPE_EN_TO_JA[t] || t),
    ability: pickAbility(p.abilities),
    form: p.baseSpecies ? p.nameJa || p.name : null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

const out = path.join(root, 'src/data/pokemon-champions.json')
fs.writeFileSync(out, JSON.stringify(pokemon, null, 2) + '\n')
console.log(`Wrote ${pokemon.length} dual-type Pokemon → ${out}`)
