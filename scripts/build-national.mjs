/**
 * Build src/data/pokemon-national.json from Pokemon Showdown pokedex.
 * Includes both mono- and dual-type Pokemon.
 * Usage:
 *   curl -sL https://play.pokemonshowdown.com/data/pokedex.json -o /tmp/pokedex.json
 *   curl -sL https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json -o /tmp/fanzeyi.json
 *   node scripts/build-national.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const dex = JSON.parse(fs.readFileSync('/tmp/pokedex.json', 'utf8'))
const fanzeyi = JSON.parse(fs.readFileSync('/tmp/fanzeyi.json', 'utf8'))
const champs = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/pokemon-champions.json'), 'utf8'),
)
const typeAbilities = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/type-abilities.json'), 'utf8'),
)

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
}

const FORME_JA = {
  Mega: 'メガ',
  'Mega-X': 'メガX',
  'Mega-Y': 'メガY',
  Alola: 'アローラのすがた',
  Galar: 'ガラルのすがた',
  Hisui: 'ヒスイのすがた',
  Wash: 'ウォッシュロトム',
  Heat: 'ヒートロトム',
  Frost: 'フロストロトム',
  Fan: 'スピンロトム',
  Mow: 'カットロトム',
}

const numToJa = new Map(fanzeyi.map((p) => [p.id, p.name.japanese]))
const idToJa = new Map(champs.map((p) => [p.id, p.name]))
const SKIP_NON = new Set(['CAP', 'Custom', 'Glitch', 'Unobtainable'])
const VALID = new Set(Object.keys(TYPE_EN_TO_JA))

function pickAbility(abilities) {
  const list = Object.keys(abilities || {})
    .sort()
    .map((k) => abilities[k])
    .filter(Boolean)
  for (const name of list) {
    if (TYPE_ABILITY[name]) {
      const a = { ...TYPE_ABILITY[name], affectsTypes: true }
      if (typeAbilities[a.id]) a.name = typeAbilities[a.id].name
      return a
    }
  }
  const first = list[0] || 'Unknown'
  return {
    id: first.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name: first,
    affectsTypes: false,
  }
}

function displayName(id, p) {
  if (idToJa.has(id)) return idToJa.get(id)
  const baseName = numToJa.get(p.num) || p.baseSpecies || p.name
  if (!p.forme) return baseName
  if (['Wash', 'Heat', 'Frost', 'Fan', 'Mow'].includes(p.forme)) {
    return FORME_JA[p.forme]
  }
  if (String(p.forme).startsWith('Mega')) {
    return (FORME_JA[p.forme] || 'メガ') + baseName
  }
  if (['Alola', 'Galar', 'Hisui'].includes(p.forme)) {
    const region = { Alola: 'アローラ', Galar: 'ガラル', Hisui: 'ヒスイ' }[
      p.forme
    ]
    return region + baseName
  }
  return `${baseName}(${FORME_JA[p.forme] || p.forme})`
}

const out = []
for (const [id, p] of Object.entries(dex)) {
  if (!p.types || (p.types.length !== 1 && p.types.length !== 2)) continue
  if (p.isNonstandard && SKIP_NON.has(p.isNonstandard)) continue
  if (String(p.forme || '')
    .toLowerCase()
    .includes('gmax'))
    continue
  if (p.types.some((t) => !VALID.has(t))) continue
  if (p.num <= 0) continue
  out.push({
    id,
    name: displayName(id, p),
    types: p.types.map((t) => TYPE_EN_TO_JA[t]),
    ability: pickAbility(p.abilities),
    form: p.forme || null,
  })
}

out.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
const dest = path.join(root, 'src/data/pokemon-national.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')
console.log(`Wrote ${out.length} → ${dest}`)
