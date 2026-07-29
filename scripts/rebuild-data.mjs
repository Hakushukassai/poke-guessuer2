/**
 * Rebuild national dex JSON, Japanese names, and evolution index.
 *
 * Prerequisites:
 *   curl -sL https://play.pokemonshowdown.com/data/pokedex.json -o /tmp/pokedex.json
 *   curl -sL https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv -o /tmp/species_names.csv
 *   curl -sL https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_forms.csv -o /tmp/pokemon_forms.csv
 *   curl -sL https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_form_names.csv -o /tmp/pokemon_form_names.csv
 *
 * Usage: node scripts/rebuild-data.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

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

const SKIP_NON = new Set(['CAP', 'Custom', 'Glitch', 'Unobtainable'])
const VALID = new Set(Object.keys(TYPE_EN_TO_JA))

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\n/)
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cols = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        q = !q
        continue
      }
      if (c === ',' && !q) {
        cols.push(cur)
        cur = ''
        continue
      }
      cur += c
    }
    cols.push(cur)
    const o = {}
    headers.forEach((h, i) => {
      o[h] = cols[i]
    })
    return o
  })
}

function toShowdownId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** showdown id → pokeapi form identifier */
function toPokeApiFormId(id) {
  return id
    .replace(/megax$/, '-mega-x')
    .replace(/megay$/, '-mega-y')
    .replace(/mega$/, '-mega')
    .replace(/alola$/, '-alola')
    .replace(/galar$/, '-galar')
    .replace(/hisui$/, '-hisui')
    .replace(/paldeablaze$/, '-paldea-blaze-breed')
    .replace(/paldeaaqua$/, '-paldea-aqua-breed')
    .replace(/paldeacombat$/, '-paldea-combat-breed')
    .replace(/wash$/, '-wash')
    .replace(/heat$/, '-heat')
    .replace(/frost$/, '-frost')
    .replace(/fan$/, '-fan')
    .replace(/mow$/, '-mow')
    .replace(/therian$/, '-therian')
    .replace(/origin$/, '-origin')
    .replace(/blade$/, '-blade')
    .replace(/shield$/, '-shield')
    .replace(/large$/, '-large')
    .replace(/small$/, '-small')
    .replace(/super$/, '-super')
    .replace(/busted$/, '-busted')
    .replace(/hangry$/, '-hangry')
    .replace(/female$/, '-female')
    .replace(/male$/, '-male')
    .replace(/f$/, '-female')
    .replace(/ice$/, '-ice')
    .replace(/shadow$/, '-shadow')
    .replace(/eternamax$/, '-eternamax')
    .replace(/gorging$/, '-gorging')
    .replace(/gulping$/, '-gulping')
}

function toSpriteSlug(id) {
  const overrides = {
    basculegionf: 'basculegion-f',
    aegislashblade: 'aegislash-blade',
    taurospaldeablaze: 'tauros-paldeablaze',
    taurospaldeaaqua: 'tauros-paldeaaqua',
    gourgeistlarge: 'gourgeist-large',
    gourgeistsuper: 'gourgeist-super',
    gourgeistsmall: 'gourgeist-small',
    vivillonfancy: 'vivillon-fancy',
    vivillonpokeball: 'vivillon-pokeball',
    mimikyubusted: 'mimikyu-busted',
    charizardmegax: 'charizard-megax',
    charizardmegay: 'charizard-megay',
    morpekohangry: 'morpeko-hangry',
    sinistchamasterpiece: 'sinistcha-masterpiece',
    calyrexice: 'calyrex-ice',
    calyrexshadow: 'calyrex-shadow',
    enamorustherian: 'enamorus-therian',
    eternatuseternamax: 'eternatus-eternamax',
    landoriustherian: 'landorus-therian',
    thundurustherian: 'thundurus-therian',
    tornadustherian: 'tornadus-therian',
    kyuremblack: 'kyurem-black',
    kyuremwhite: 'kyurem-white',
    groudonprimal: 'groudon-primal',
    kyogreprimal: 'kyogre-primal',
    greninjaash: 'greninja-ash',
    greninjabond: 'greninja-bond',
    ursalunabloodmoon: 'ursaluna-bloodmoon',
    urshifurapidstrike: 'urshifu-rapidstrike',
    oricoriopompom: 'oricorio-pompom',
    oricoriopau: 'oricorio-pau',
    oricoriosensu: 'oricorio-sensu',
    wooperpaldea: 'wooper-paldea',
    squawkabillyblue: 'squawkabilly-blue',
    squawkabillyyellow: 'squawkabilly-yellow',
    squawkabillywhite: 'squawkabilly-white',
    cramorantgulping: 'cramorant-gulping',
    cramorantgorging: 'cramorant-gorging',
    necrozmaultra: 'necrozma-ultra',
    necrozmadawnwings: 'necrozma-dawnwings',
    necrozmaduskmane: 'necrozma-duskmane',
    ogerponwellspring: 'ogerpon-wellspring',
    ogerponcornerstone: 'ogerpon-cornerstone',
    ogerponhearthflame: 'ogerpon-hearthflame',
    keldeoresolute: 'keldeo-resolute',
    genesectdouse: 'genesect-douse',
    genesectshock: 'genesect-shock',
    genesectburn: 'genesect-burn',
    genesectchill: 'genesect-chill',
    zaciancrowned: 'zacian-crowned',
    zamazentacrowned: 'zamazenta-crowned',
    shayminsky: 'shaymin-sky',
    zygarde10: 'zygarde-10',
    zygardecomplete: 'zygarde-complete',
    tatsugiridroopy: 'tatsugiri-droopy',
    tatsugiristretchy: 'tatsugiri-stretchy',
    miniormeteor: 'minior',
    magearnaoriginal: 'magearna-original',
    toxtricitylowkey: 'toxtricity-lowkey',
    darmanitanzen: 'darmanitan-zen',
    darmanitangalarzen: 'darmanitan-galarzen',
    hoopaunbound: 'hoopa-unbound',
    wormadamsandy: 'wormadam-sandy',
    wormadamtrash: 'wormadam-trash',
    meloettapirouette: 'meloetta-pirouette',
    giratinaorigin: 'giratina-origin',
  }
  if (overrides[id]) return overrides[id]
  return id
    .replace(/megax$/, '-megax')
    .replace(/megay$/, '-megay')
    .replace(/mega$/, '-mega')
    .replace(/alola$/, '-alola')
    .replace(/galar$/, '-galar')
    .replace(/hisui$/, '-hisui')
    .replace(/(rotom)(wash|heat|frost|fan|mow)$/, '$1-$2')
    .replace(/therian$/, '-therian')
    .replace(/origin$/, '-origin')
    .replace(/blade$/, '-blade')
    .replace(/busted$/, '-busted')
    .replace(/hangry$/, '-hangry')
    .replace(/ice$/, '-ice')
    .replace(/shadow$/, '-shadow')
}

const dex = JSON.parse(fs.readFileSync('/tmp/pokedex.json', 'utf8'))
const typeAbilities = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/type-abilities.json'), 'utf8'),
)
const champsExisting = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/pokemon-champions.json'), 'utf8'),
)

const speciesJa = new Map()
for (const row of parseCsv('/tmp/species_names.csv')) {
  if (row.local_language_id === '1') speciesJa.set(row.pokemon_species_id, row.name)
}

const formIdToJa = new Map()
const forms = parseCsv('/tmp/pokemon_forms.csv')
const formNames = parseCsv('/tmp/pokemon_form_names.csv').filter(
  (r) => r.local_language_id === '1',
)
const formById = new Map(forms.map((f) => [f.id, f]))
for (const n of formNames) {
  const f = formById.get(n.pokemon_form_id)
  if (!f) continue
  formIdToJa.set(f.identifier, {
    formName: n.form_name || '',
    pokemonName: n.pokemon_name || '',
  })
}

function pickAbility(abilities) {
  const list = Object.keys(abilities || {})
    .sort((a, b) => Number(a === 'H') - Number(b === 'H'))
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

function looksJapanese(s) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(s)
}

function displayName(id, p) {
  const apiId = toPokeApiFormId(id)
  const formMeta = formIdToJa.get(apiId) || formIdToJa.get(apiId.replace(/-breed$/, ''))
  const baseJa = speciesJa.get(String(p.num)) || ''

  if (formMeta?.pokemonName && looksJapanese(formMeta.pokemonName)) {
    return formMeta.pokemonName
  }
  if (formMeta?.formName && looksJapanese(formMeta.formName)) {
    // メガガブリアス / ウォッシュロトム などフル名
    if (!formMeta.formName.includes('のすがた') && !formMeta.formName.includes('フォルム') && !formMeta.formName.includes('のめん') && formMeta.formName.length >= 3 && !/^[\u30a1-\u30fc]$/.test(formMeta.formName)) {
      // If form name looks like full species (starts with メガ or is long katakana name)
      if (
        formMeta.formName.startsWith('メガ') ||
        formMeta.formName.includes('ロトム') ||
        formMeta.formName.length >= 5
      ) {
        return formMeta.formName.replace(/[Ａ-Ｚ]/g, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0xfee0),
        )
      }
    }
    if (baseJa) {
      if (formMeta.formName.includes('アローラ')) return `アローラ${baseJa}`
      if (formMeta.formName.includes('ガラル')) return `ガラル${baseJa}`
      if (formMeta.formName.includes('ヒスイ')) return `ヒスイ${baseJa}`
      if (formMeta.formName.includes('パルデア')) return `${baseJa}(${formMeta.formName})`
      return `${baseJa}(${formMeta.formName})`
    }
  }

  if (baseJa && !p.forme) return baseJa

  // Fallbacks for common formes
  if (baseJa && p.forme) {
    const f = String(p.forme)
    const FORME_MAP = {
      Mega: `メガ${baseJa}`,
      'Mega-X': `メガ${baseJa}X`,
      'Mega-Y': `メガ${baseJa}Y`,
      'Mega-Z': `メガ${baseJa}Z`,
      Alola: `アローラ${baseJa}`,
      Galar: `ガラル${baseJa}`,
      Hisui: `ヒスイ${baseJa}`,
      Paldea: `パルデア${baseJa}`,
      Wash: 'ウォッシュロトム',
      Heat: 'ヒートロトム',
      Frost: 'フロストロトム',
      Fan: 'スピンロトム',
      Mow: 'カットロトム',
      Therian: `${baseJa}(れいじゅうフォルム)`,
      Origin: `${baseJa}(オリジンフォルム)`,
      Ice: `${baseJa}(はくばじょうのすがた)`,
      Shadow: `${baseJa}(こくばじょうのすがた)`,
      Totem: `${baseJa}(ぬし)`,
      'Alola-Totem': `アローラ${baseJa}(ぬし)`,
      Primal: `ゲンシ${baseJa}`,
      Ash: `${baseJa}(サトシゲッコウガ)`,
      Bond: `${baseJa}(きずな)`,
      Blue: `${baseJa}(ブルーフェザー)`,
      White: `${baseJa}(ホワイトフェザー)`,
      Yellow: `${baseJa}(イエローフェザー)`,
      'Pa\'u': `${baseJa}(パウススタイル)`,
      'Pom-Pom': `${baseJa}(ポムポムスタイル)`,
      Sensu: `${baseJa}(まいまいスタイル)`,
      Burn: `${baseJa}(ブレイズカセット)`,
      Chill: `${baseJa}(フリーズカセット)`,
      Douse: `${baseJa}(アクアカセット)`,
      Shock: `${baseJa}(イナズマカセット)`,
      Black: `${baseJa}(ブラックキュレム)`,
      // White already used for squawkabilly - kyurem white:
      Bloodmoon: `${baseJa}(アカツキ)`,
      'Rapid-Strike': `${baseJa}(れんげきのかた)`,
      'Single-Strike': `${baseJa}(いちげきのかた)`,
      Cornerstone: `${baseJa}(いわののめん)`,
      Hearthflame: `${baseJa}(かまどのめん)`,
      Wellspring: `${baseJa}(いどのめん)`,
      Eternamax: `${baseJa}(ムゲンダイマックス)`,
      Gorging: `${baseJa}(うのみのすがた)`,
      Gulping: `${baseJa}(まるのみのすがた)`,
      Resolute: `${baseJa}(かくごのすがた)`,
      Crowned: `${baseJa}(おうのすがた)`,
      Dada: `${baseJa}(おやじ)`,
      Sky: `${baseJa}(スカイフォルム)`,
      Complete: `${baseJa}(パーフェクトフォルム)`,
      Curly: `${baseJa}(そったすがた)`,
      Droopy: `${baseJa}(たれたすがた)`,
      Stretchy: `${baseJa}(のびたすがた)`,
      'Curly-Mega': `メガ${baseJa}(そったすがた)`,
      'Droopy-Mega': `メガ${baseJa}(たれたすがた)`,
      'Stretchy-Mega': `メガ${baseJa}(のびたすがた)`,
      'Low-Key': `${baseJa}(ローなすがた)`,
      Artisan: `${baseJa}(せいじゅくなすがた)`,
      'Dawn-Wings': `${baseJa}(あかつきのつばさ)`,
      'Dusk-Mane': `${baseJa}(たそがれのたてがみ)`,
      Ultra: `ウルトラ${baseJa}`,
      Zen: `${baseJa}(ダルマモード)`,
      'Galar-Zen': `ガラル${baseJa}(ダルマモード)`,
      Fancy: `${baseJa}(ファンシーなもよう)`,
      Pokeball: `${baseJa}(ボールのもよう)`,
      Unbound: `${baseJa}(ときはなたれしすがた)`,
      Original: `${baseJa}(500ねんまえのいろ)`,
      'Original-Mega': `メガ${baseJa}(500ねんまえのいろ)`,
      Sandy: `${baseJa}(すなちのみの)`,
      Trash: `${baseJa}(ゴミのみの)`,
      'Busted-Totem': `${baseJa}(ばれたすがた・ぬし)`,
      Meteor: `${baseJa}(りゅうせいのすがた)`,
      Pirouette: `${baseJa}(ステップフォルム)`,
      Masterpiece: `${baseJa}(傑作)`,
    }
    if (FORME_MAP[f]) return FORME_MAP[f]
    // Kyurem White conflicts with Squawkabilly White - handle by species
    if (f === 'White' && baseJa === 'キュレム') return 'ホワイトキュレム'
    if (f === 'Black' && baseJa === 'キュレム') return 'ブラックキュレム'
    if (f === 'White' && baseJa === 'イキリンコ') return 'イキリンコ(ホワイトフェザー)'
    return `${baseJa}(${f})`
  }

  return baseJa || p.name
}

function buildEntry(id, p) {
  const ability = pickAbility(p.abilities || {})
  return {
    id,
    name: displayName(id, p),
    types: p.types.map((t) => TYPE_EN_TO_JA[t]),
    ability,
    form: p.forme || null,
    sprite: toSpriteSlug(id),
    num: p.num,
  }
}

// --- national ---
const national = []
for (const [id, p] of Object.entries(dex)) {
  if (!p.types || p.types.length !== 2) continue
  if (p.isNonstandard && SKIP_NON.has(p.isNonstandard)) continue
  if (String(p.forme || '')
    .toLowerCase()
    .includes('gmax'))
    continue
  // オーガポンのめんフォルムと被るテラスタル戦フォルムは除外
  if (String(p.forme || '')
    .toLowerCase()
    .includes('tera'))
    continue
  if (p.types.some((t) => !VALID.has(t))) continue
  if (p.num <= 0) continue
  national.push(buildEntry(id, p))
}
national.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

// --- champions: keep membership, refresh names/sprites ---
const champIds = new Set(champsExisting.map((p) => p.id))
const champions = champsExisting.map((old) => {
  const p = dex[old.id]
  if (!p) {
    return { ...old, sprite: old.sprite || toSpriteSlug(old.id) }
  }
  const built = buildEntry(old.id, p)
  // keep ability pick from existing champions curation when present
  return {
    ...built,
    ability: old.ability?.id ? old.ability : built.ability,
    name: looksJapanese(built.name) ? built.name : old.name,
  }
})
champions.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

// --- evo index (base species only) ---
const evoIndex = {}
for (const [id, p] of Object.entries(dex)) {
  if (p.baseSpecies) continue // skip alternate formes for chain walking
  evoIndex[id] = {
    prevo: p.prevo ? toShowdownId(p.prevo) : null,
    evos: (p.evos || []).map(toShowdownId),
    num: p.num,
  }
}

fs.writeFileSync(
  path.join(root, 'src/data/pokemon-national.json'),
  JSON.stringify(national, null, 2) + '\n',
)
fs.writeFileSync(
  path.join(root, 'src/data/pokemon-champions.json'),
  JSON.stringify(champions, null, 2) + '\n',
)
fs.writeFileSync(
  path.join(root, 'src/data/evo-index.json'),
  JSON.stringify(evoIndex) + '\n',
)

const stillEng = national.filter(
  (p) => /[A-Za-z]/.test(p.name.replace(/[XYZ]/g, '')),
)
console.log('national', national.length, 'champions', champions.length)
console.log('still latin names', stillEng.length)
console.log(stillEng.slice(0, 30).map((p) => p.id + '|' + p.name).join('\n'))
console.log('champ ids still valid', [...champIds].filter((id) => !dex[id]).slice(0, 10))
