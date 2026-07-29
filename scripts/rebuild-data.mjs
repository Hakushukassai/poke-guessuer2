/**
 * Rebuild national dex JSON, Japanese names, and evolution index.
 * Includes both mono- and dual-type Pokemon.
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

function normalizeJaFormName(s) {
  return String(s).replace(/[Ａ-Ｚ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
}

/** ベース種族名だけで足りる「通常の姿」ラベルか */
function isDefaultAppearanceLabel(formName, baseJa) {
  if (!baseJa) return false
  return formName === baseJa || formName === `${baseJa}のすがた`
}

/** 種族名を置き換える完全別名（ブラックキュレム・サトシゲッコウガ・メガ等） */
function isFullAlternateName(formName, baseJa) {
  if (formName.startsWith('メガ') || formName.startsWith('ゲンシ') || formName.startsWith('ウルトラ')) {
    return true
  }
  if (/ロトム$/.test(formName) && formName !== 'ロトム') return true
  if (!baseJa || formName === baseJa) return false
  // 括弧表記すべき説明ラベルは除外
  if (
    formName.includes('のすがた') ||
    formName.includes('フォルム') ||
    formName.includes('のめん') ||
    formName.includes('スタイル') ||
    formName.includes('カセット') ||
    formName.includes('モード') ||
    formName.includes('タイプ') ||
    formName.startsWith('タイプ')
  ) {
    return false
  }
  return formName.includes(baseJa)
}

function displayName(id, p) {
  const apiId = toPokeApiFormId(id)
  const formMeta = formIdToJa.get(apiId) || formIdToJa.get(apiId.replace(/-breed$/, ''))
  const baseJa = speciesJa.get(String(p.num)) || ''

  // 通常の姿（リージョン・別フォルムでない）は種族名のみ。括弧を付けない
  if (!p.forme && baseJa) return baseJa

  if (formMeta?.pokemonName && looksJapanese(formMeta.pokemonName)) {
    return formMeta.pokemonName
  }
  if (formMeta?.formName && looksJapanese(formMeta.formName)) {
    const fn = normalizeJaFormName(formMeta.formName)

    if (isDefaultAppearanceLabel(fn, baseJa)) return baseJa

    // アルセウス「こおりタイプ」/ シルヴァディ「タイプ：アイス」など
    if (fn.endsWith('タイプ') || fn.startsWith('タイプ')) {
      const SILVALLY_TO_JA = {
        'タイプ：ノーマル': 'ノーマルタイプ',
        'タイプ：ファイト': 'かくとうタイプ',
        'タイプ：フライング': 'ひこうタイプ',
        'タイプ：ポイズン': 'どくタイプ',
        'タイプ：グラウンド': 'じめんタイプ',
        'タイプ：ロック': 'いわタイプ',
        'タイプ：バグ': 'むしタイプ',
        'タイプ：ゴースト': 'ゴーストタイプ',
        'タイプ：スチール': 'はがねタイプ',
        'タイプ：ファイヤー': 'ほのおタイプ',
        'タイプ：ウオーター': 'みずタイプ',
        'タイプ：グラス': 'くさタイプ',
        'タイプ：エレクトロ': 'でんきタイプ',
        'タイプ：サイキック': 'エスパータイプ',
        'タイプ：アイス': 'こおりタイプ',
        'タイプ：ドラゴン': 'ドラゴンタイプ',
        'タイプ：ダーク': 'あくタイプ',
        'タイプ：フェアリー': 'フェアリータイプ',
      }
      const label = SILVALLY_TO_JA[fn] || fn
      return baseJa ? `${baseJa}(${label})` : label
    }

    if (isFullAlternateName(fn, baseJa)) return fn

    if (baseJa) {
      if (fn.includes('アローラ')) return `アローラ${baseJa}`
      if (fn.includes('ガラル')) return `ガラル${baseJa}`
      if (fn.includes('ヒスイ')) return `ヒスイ${baseJa}`
      if (fn.includes('パルデア')) return `パルデア${baseJa}`
      return `${baseJa}(${fn})`
    }
    return fn
  }

  // Fallbacks for common formes
  if (baseJa && p.forme) {
    const f = String(p.forme)
    // 同名キー衝突は種族で先に分岐
    if (f === 'White' && baseJa === 'キュレム') return 'ホワイトキュレム'
    if (f === 'Black' && baseJa === 'キュレム') return 'ブラックキュレム'
    if (f === 'White' && baseJa === 'イキリンコ') return `${baseJa}(ホワイトフェザー)`
    if (f === 'Ice' && (baseJa === 'アルセウス' || baseJa === 'シルヴァディ')) {
      return `${baseJa}(こおりタイプ)`
    }
    if (f === 'Ice' && baseJa === 'バドレックス') return `${baseJa}(はくばじょうのすがた)`
    if (f === 'Ash') return 'サトシゲッコウガ'

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
      Bond: `${baseJa}(きずな)`,
      Blue: `${baseJa}(ブルーフェザー)`,
      White: `${baseJa}(ホワイトフェザー)`,
      Yellow: `${baseJa}(イエローフェザー)`,
      "Pa'u": `${baseJa}(パウススタイル)`,
      'Pom-Pom': `${baseJa}(ポムポムスタイル)`,
      Sensu: `${baseJa}(まいまいスタイル)`,
      Burn: `${baseJa}(ブレイズカセット)`,
      Chill: `${baseJa}(フリーズカセット)`,
      Douse: `${baseJa}(アクアカセット)`,
      Shock: `${baseJa}(イナズマカセット)`,
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
      // アルセウス・シルヴァディのタイプフォーム
      Bug: `${baseJa}(むしタイプ)`,
      Dark: `${baseJa}(あくタイプ)`,
      Dragon: `${baseJa}(ドラゴンタイプ)`,
      Electric: `${baseJa}(でんきタイプ)`,
      Fairy: `${baseJa}(フェアリータイプ)`,
      Fighting: `${baseJa}(かくとうタイプ)`,
      Fire: `${baseJa}(ほのおタイプ)`,
      Flying: `${baseJa}(ひこうタイプ)`,
      Ghost: `${baseJa}(ゴーストタイプ)`,
      Grass: `${baseJa}(くさタイプ)`,
      Ground: `${baseJa}(じめんタイプ)`,
      Normal: `${baseJa}(ノーマルタイプ)`,
      Poison: `${baseJa}(どくタイプ)`,
      Psychic: `${baseJa}(エスパータイプ)`,
      Rock: `${baseJa}(いわタイプ)`,
      Steel: `${baseJa}(はがねタイプ)`,
      Water: `${baseJa}(みずタイプ)`,
      Stellar: `${baseJa}(ステラフォルム)`,
      Rainy: `${baseJa}(あめのすがた)`,
      Snowy: `${baseJa}(ゆきのすがた)`,
      Sunny: `${baseJa}(はれのすがた)`,
      Sunshine: `${baseJa}(てりてりのすがた)`,
      Attack: `${baseJa}(アタックフォルム)`,
      Defense: `${baseJa}(ディフェンスフォルム)`,
      Speed: `${baseJa}(スピードフォルム)`,
      Noice: `${baseJa}(ノイスフェイス)`,
      Roaming: `${baseJa}(さすらいのすがた)`,
      Antique: `${baseJa}(アンティークのすがた)`,
      'Blue-Striped': `${baseJa}(あおすじ)`,
      'White-Striped': `${baseJa}(しろすじ)`,
      Belle: `${baseJa}(ベルのコスプレ)`,
      Cosplay: `${baseJa}(コスプレ)`,
      Hoenn: `${baseJa}(ホウエンキャップ)`,
      Kalos: `${baseJa}(カロスキャップ)`,
      Libre: `${baseJa}(リブレのコスプレ)`,
      Partner: `${baseJa}(パートナーキャップ)`,
      PhD: `${baseJa}(はかせのコスプレ)`,
      'Pop-Star': `${baseJa}(ポップスターのコスプレ)`,
      'Rock-Star': `${baseJa}(ロックスターのコスプレ)`,
      Sinnoh: `${baseJa}(シンオウキャップ)`,
      Starter: `${baseJa}(スターターキャップ)`,
      Unova: `${baseJa}(イッシュキャップ)`,
      World: `${baseJa}(ワールドキャップ)`,
      'Spiky-eared': `${baseJa}(ギザミミ)`,
      Eternal: `${baseJa}(えいえんのはな)`,
      School: `${baseJa}(むれのすがた)`,
      Dusk: `${baseJa}(たそがれのすがた)`,
      Midnight: `${baseJa}(まよなかのすがた)`,
      Four: `${baseJa}(4ひき)`,
      Hero: `${baseJa}(ヒーローのすがた)`,
      'F-Mega': `メガ${baseJa}(めす)`,
      'M-Mega': `メガ${baseJa}(おす)`,
      'Three-Segment': `${baseJa}(3れんのすがた)`,
    }
    if (FORME_MAP[f]) return FORME_MAP[f]
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

/**
 * タイプ相性クイズで性能が変わらないのに紛らわしいフォルム。
 * （タイプが違うバトルフォルムでも、一時姿として出さないもの）
 */
const SKIP_COSMETIC_IDS = new Set([
  // ポワルン：天気でタイプは変わるが一時姿のためベースのみ
  'castformsunny',
  'castformrainy',
  'castformsnowy',
])

/** タイプ＋相性特性が同じなら同一性能とみなす */
function performanceKey(entry) {
  const ab = entry.ability?.affectsTypes ? entry.ability.id : '_'
  return `${entry.num}|${[...entry.types].sort().join('/')}|${ab}`
}

/** 通常の姿（formeなし）を優先。例外は対戦で標準の見た目 */
const PREFERRED_ALT_IDS = new Set([
  'mausholdfour', // 図鑑・対戦では4ひきが標準
])

/** 通常の姿（formeなし）を優先して残す */
function preferCanonical(a, b) {
  if (PREFERRED_ALT_IDS.has(a.id) !== PREFERRED_ALT_IDS.has(b.id)) {
    return PREFERRED_ALT_IDS.has(a.id) ? -1 : 1
  }
  const da = dex[a.id]
  const db = dex[b.id]
  const aBase = da && !da.forme ? 0 : 1
  const bBase = db && !db.forme ? 0 : 1
  if (aBase !== bBase) return aBase - bBase
  const aBattle = da?.battleOnly ? 1 : 0
  const bBattle = db?.battleOnly ? 1 : 0
  if (aBattle !== bBattle) return aBattle - bBattle
  return a.id.localeCompare(b.id)
}

/**
 * 見た目・名前違いだけでタイプ相性が同じエントリを1つにまとめる。
 * 例: ピカチュウのキャップ、デオキシス各フォルム、同タイプメガなど。
 */
function dedupeByPerformance(entries) {
  const best = new Map()
  for (const e of entries) {
    const k = performanceKey(e)
    const cur = best.get(k)
    if (!cur || preferCanonical(e, cur) < 0) best.set(k, e)
  }
  const keptIds = new Set([...best.values()].map((e) => e.id))
  const removedToKeep = new Map()
  for (const e of entries) {
    if (keptIds.has(e.id)) continue
    const winner = best.get(performanceKey(e))
    if (winner) removedToKeep.set(e.id, winner.id)
  }
  return { kept: [...best.values()], removedToKeep }
}

// --- national ---
const nationalRaw = []
for (const [id, p] of Object.entries(dex)) {
  if (!p.types || (p.types.length !== 1 && p.types.length !== 2)) continue
  if (p.isNonstandard && SKIP_NON.has(p.isNonstandard)) continue
  if (SKIP_COSMETIC_IDS.has(id)) continue
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
  nationalRaw.push(buildEntry(id, p))
}

const { kept: nationalKept, removedToKeep } = dedupeByPerformance(nationalRaw)
const national = nationalKept
national.sort((a, b) => (a.num - b.num) || a.id.localeCompare(b.id))
const nationalById = new Map(national.map((p) => [p.id, p]))

// --- champions: keep membership, refresh names/sprites, drop cosmetic dupes ---
const champIds = new Set(champsExisting.map((p) => p.id))
const champions = []
const seenChampPerf = new Set()
for (const old of champsExisting) {
  const keepId = nationalById.has(old.id)
    ? old.id
    : removedToKeep.get(old.id)
  if (!keepId || !nationalById.has(keepId)) continue
  const kept = nationalById.get(keepId)
  const perf = performanceKey(kept)
  if (seenChampPerf.has(perf)) continue
  seenChampPerf.add(perf)
  const p = dex[keepId]
  if (!p) {
    champions.push({ ...kept })
    continue
  }
  const built = buildEntry(keepId, p)
  champions.push({
    ...built,
    ability: old.ability?.id && old.id === keepId ? old.ability : built.ability,
    name: looksJapanese(built.name) ? built.name : old.name,
  })
}
champions.sort((a, b) => (a.num - b.num) || a.id.localeCompare(b.id))

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
console.log(
  'national',
  national.length,
  '(raw',
  nationalRaw.length,
  ', removed',
  nationalRaw.length - national.length + ')',
  'champions',
  champions.length,
)
console.log('still latin names', stillEng.length)
if (stillEng.length) {
  console.log(stillEng.slice(0, 30).map((p) => p.id + '|' + p.name).join('\n'))
}
console.log('champ ids dropped', [...champIds].filter((id) => !nationalById.has(id) && !removedToKeep.has(id)).slice(0, 10))
console.log('sample removed', [...removedToKeep.entries()].slice(0, 15).map(([a, b]) => a + '→' + b).join(', '))
