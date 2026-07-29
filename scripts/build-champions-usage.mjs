/**
 * Build compact Champions OU usage summaries for competitive pick UX.
 *
 * Prerequisites:
 *   curl -sL https://www.smogon.com/stats/2026-04/chaos/gen9championsou-1500.json.gz \
 *     | gzip -dc > /tmp/champ_ou.json
 *   /tmp/pokedex.json (Showdown)
 *
 * Usage: node scripts/build-champions-usage.mjs [/tmp/champ_ou.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const chaosPath = process.argv[2] || '/tmp/champ_ou.json'
const chaos = JSON.parse(fs.readFileSync(chaosPath, 'utf8'))
const dex = JSON.parse(fs.readFileSync('/tmp/pokedex.json', 'utf8'))
const dual = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/pokemon-champions.json'), 'utf8'),
)
const mono = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/pokemon-champions-mono.json'), 'utf8'),
)
const competitive = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/competitive-champions.json'), 'utf8'),
)

const MOVE_JA = {
  stealthrock: 'ステルスロック',
  spikes: 'まきびし',
  toxicspikes: 'どくびし',
  stickyweb: 'ねばねばネット',
  defog: 'ぼうじん',
  rapidspin: 'こうそくスピン',
  mortalspin: 'キラースピン',
  roost: 'はねやすめ',
  recover: 'じこさいせい',
  softboiled: 'タマゴうみ',
  slackoff: 'なまける',
  synthesis: 'こうごうせい',
  moonlight: 'つきのひかり',
  morningsun: 'あさのひざし',
  wish: 'ねがいごと',
  uturn: 'とんぼがえり',
  voltswitch: 'ボルトチェンジ',
  flipturn: 'クイックターン',
  partingshot: 'つぶやき',
  teleport: 'テレポート',
  swordsdance: 'つるぎのまい',
  nastyplot: 'わるだくみ',
  dragondance: 'りゅうのまい',
  calmmind: 'めいそう',
  bulkup: 'ビルドアップ',
  quiverdance: 'ちょうのまい',
  shellsmash: 'からをやぶる',
  shiftgear: 'ギアチェンジ',
  earthquake: 'じしん',
  dragontail: 'ドラゴンテール',
  bodypress: 'ボディプレス',
  suckerpunch: 'ふいうち',
  extremespeed: 'しんそく',
  iceshard: 'こおりのつぶて',
  bulletpunch: 'バレットパンチ',
  aquajet: 'アクアジェット',
  shadowsneak: 'かげうち',
  closecombat: 'インファイト',
  knockoff: 'はたきおとす',
  willowisp: 'おにび',
  thunderwave: 'でんじは',
  toxic: 'どくどく',
  taunt: 'ちょうはつ',
  encore: 'アンコール',
  protect: 'まもる',
  substitute: 'みがわり',
  hex: 'たたりめ',
  dracometeor: 'りゅうせいぐん',
  ironhead: 'アイアンヘッド',
  poltergeist: 'ポルターガイスト',
  kingsshield: 'キングシールド',
  ceaselessedge: 'ひけん・ちえなみ',
  razorshell: 'シェルブレード',
  sacredsword: 'せいなるつるぎ',
  direclaw: 'どくどくのツメ',
  throatchop: 'のどねらい',
  kowtowcleave: 'ドゲザン',
  firstimpression: 'であいがしら',
  wavecrash: 'ウェーブタックル',
  hydropump: 'ハイドロポンプ',
  scald: 'ねっとう',
  flareblitz: 'フレアドライブ',
  moonblast: 'ムーンフォース',
  psychicnoise: 'サイコノイズ',
  futuresight: 'みらいよち',
  shadowball: 'シャドーボール',
  focusblast: 'きあいだま',
  populationbomb: 'ネズミざん',
  tidyup: 'おかたづけ',
  bite: 'かみつく',
  kingsrock: 'おうじゃのしるし',
  stoneaxe: 'がんせきアックス',
  courtchange: 'コートチェンジ',
  chillyreception: 'さむいギャグ',
  shedtail: 'しっぽきり',
  milkdrink: 'ミルクのみ',
  shoreup: 'すなあつめ',
  strengthsap: 'ちからをすいとる',
  clangoroussoul: 'ソウルビート',
  victorydance: 'しょうりのまい',
  takeheart: 'テラクラスター',
  coil: 'とぐろをまく',
  machpunch: 'マッハパンチ',
  accelerock: 'アクセルロック',
  grassyglide: 'グラススライダー',
  jetpunch: 'ジェットパンチ',
  thunderclap: 'じんらい',
  watershuriken: 'みずしゅりけん',
  fakeout: 'ねこだまし',
}

const ITEM_JA = {
  leftovers: 'たべのこし',
  sitrusberry: 'オボンのみ',
  focussash: 'きあいのタスキ',
  choicescarf: 'こだわりスカーフ',
  choiceband: 'こだわりハチマキ',
  choicespecs: 'こだわりメガネ',
  lifeorb: 'いのちのたま',
  heavydutyboots: 'ぼうじんブーツ',
  assaultvest: 'とつげきチョッキ',
  rockyhelmet: 'ゴツゴツメット',
  lumberry: 'ラムのみ',
  blackglasses: 'くろいメガネ',
  softsand: 'やわらかいすな',
  spelltag: 'のろいのおふだ',
  dragonfang: 'りゅうのキバ',
  whiteherb: 'しろいハーブ',
  yacheberry: 'ヤチェのみ',
  expertbelt: 'たつじんのおび',
  boosterenergy: 'ブーストエナジー',
  loadeddice: 'いかさまダイス',
  airballoon: 'ふうせん',
  lightclay: 'ひかりのねんど',
  mentalherb: 'メンタルハーブ',
  weaknesspolicy: 'じゃくてんほけん',
  kingsrock: 'おうじゃのしるし',
  throatspray: 'のどスプレー',
}

const HAZARD_SET = new Set([
  'stealthrock',
  'spikes',
  'toxicspikes',
  'stickyweb',
  'ceaselessedge',
  'stoneaxe',
])
const HAZARD_CTRL = new Set([
  'defog',
  'rapidspin',
  'mortalspin',
  'tidyup',
  'courtchange',
])
const SETUP = new Set([
  'swordsdance',
  'nastyplot',
  'dragondance',
  'quiverdance',
  'calmmind',
  'bulkup',
  'coil',
  'shiftgear',
  'shellsmash',
  'clangoroussoul',
  'victorydance',
  'takeheart',
])
const PIVOT = new Set([
  'uturn',
  'voltswitch',
  'flipturn',
  'partingshot',
  'teleport',
  'chillyreception',
  'shedtail',
])
const RECOVERY = new Set([
  'roost',
  'recover',
  'softboiled',
  'slackoff',
  'milkdrink',
  'shoreup',
  'synthesis',
  'moonlight',
  'morningsun',
  'wish',
  'strengthsap',
])
const PRIORITY = new Set([
  'suckerpunch',
  'extremespeed',
  'iceshard',
  'bulletpunch',
  'aquajet',
  'shadowsneak',
  'machpunch',
  'firstimpression',
  'accelerock',
  'grassyglide',
  'jetpunch',
  'thunderclap',
  'watershuriken',
  'fakeout',
])
const PASSIVE_ITEM = new Set([
  'leftovers',
  'heavydutyboots',
  'rockyhelmet',
  'assaultvest',
])

function toId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const pool = [...dual, ...mono]
const poolIds = new Set(pool.map((p) => p.id))

/** Showdown species display name → dex id */
const nameToId = new Map()
for (const [id, p] of Object.entries(dex)) {
  if (!p?.name) continue
  const label = p.forme ? `${p.name}-${p.forme}` : p.name
  nameToId.set(label, id)
  nameToId.set(p.name, nameToId.get(p.name) || id)
}

/**
 * Chaos often lists the base species while our Champions pool keeps a specific
 * battle forme (e.g. Maushold → mausholdfour). Prefer that pool id.
 */
const SPECIES_TO_POOL = {
  Maushold: 'mausholdfour',
  Aegislash: 'aegislashblade',
  Morpeko: 'morpekohangry',
  Mimikyu: 'mimikyubusted',
  Vivillon: 'vivillonfancy',
  Sinistcha: 'sinistchamasterpiece',
}

function resolveOurId(speciesName) {
  if (SPECIES_TO_POOL[speciesName] && poolIds.has(SPECIES_TO_POOL[speciesName])) {
    return SPECIES_TO_POOL[speciesName]
  }
  const dexId = nameToId.get(speciesName) || toId(speciesName)
  if (poolIds.has(dexId)) return dexId
  for (const id of poolIds) {
    if (id.startsWith(dexId) && id !== dexId) return id
  }
  return dexId
}

function topWeighted(obj, n) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

function moveJa(id) {
  return MOVE_JA[id] || id
}

function itemJa(id) {
  return ITEM_JA[id] || id
}

function deriveRoles(topMoves, topItem, traits) {
  const roles = []
  const moves = new Set(topMoves)
  if ([...HAZARD_SET].some((m) => moves.has(m)) || traits?.hazard_set) {
    roles.push('設置')
  }
  if ([...HAZARD_CTRL].some((m) => moves.has(m)) || traits?.hazard_ctrl) {
    roles.push('除去')
  }
  if ([...SETUP].some((m) => moves.has(m))) roles.push('積み')
  if ([...PIVOT].some((m) => moves.has(m)) || traits?.pivot) roles.push('サイクル')
  if (
    ([...RECOVERY].some((m) => moves.has(m)) && PASSIVE_ITEM.has(topItem)) ||
    (traits?.recovery && PASSIVE_ITEM.has(topItem))
  ) {
    roles.push('受け')
  } else if ([...RECOVERY].some((m) => moves.has(m)) && roles.length === 0) {
    roles.push('受け')
  }
  if ([...PRIORITY].some((m) => moves.has(m)) || traits?.priority) {
    roles.push('先制')
  }
  if (roles.length === 0) roles.push('対面')
  return [...new Set(roles)].slice(0, 3)
}

function blurbFor(roles, topMoves, topItem) {
  const moveBits = topMoves.slice(0, 2).map(moveJa)
  const roleBit = roles.slice(0, 2).join('・')
  const itemBit = topItem ? itemJa(topItem) : ''
  if (moveBits.length && itemBit) {
    return `${roleBit}枠 · ${moveBits.join('＋')} / ${itemBit}`
  }
  if (moveBits.length) return `${roleBit}枠 · ${moveBits.join('＋')}`
  return `${roleBit}枠`
}

const ranked = Object.entries(chaos.data || {})
  .map(([speciesName, row]) => ({
    speciesName,
    usage: typeof row.usage === 'number' ? row.usage : 0,
    raw: row['Raw count'] || 0,
    moves: topWeighted(row.Moves, 8),
    items: topWeighted(row.Items, 3),
    abilities: topWeighted(row.Abilities, 2),
  }))
  .sort((a, b) => b.usage - a.usage)

const byId = {}
let matched = 0
ranked.forEach((row, index) => {
  const id = resolveOurId(row.speciesName)
  if (!poolIds.has(id)) return
  // Prefer higher usage if duplicate forme mapping collapses
  if (byId[id] && byId[id].usage >= row.usage) return

  const topMoves = row.moves.slice(0, 3)
  const topItem = row.items[0] || null
  const traits = competitive[id]?.traits
  const roles = deriveRoles(topMoves, topItem, traits)
  byId[id] = {
    usage: row.usage,
    rank: index + 1,
    topMoves: topMoves.map((m) => ({ id: m, name: moveJa(m) })),
    topItem: topItem
      ? { id: topItem, name: itemJa(topItem) }
      : null,
    roles,
    blurb: blurbFor(roles, topMoves, topItem),
  }
  matched += 1
})

// Re-rank only among matched pool species by usage
const ordered = Object.entries(byId).sort((a, b) => b[1].usage - a[1].usage)
ordered.forEach(([id], i) => {
  byId[id].rank = i + 1
})

const out = {
  source: {
    metagame: chaos.info?.metagame || 'gen9championsou',
    cutoff: chaos.info?.cutoff ?? 1500,
    month: '2026-04',
    battles: chaos.info?.['number of battles'] ?? null,
    label: 'Smogon Champions OU 1500（2026-04）',
  },
  pokemon: byId,
}

const outPath = path.join(root, 'src/data/champions-usage.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')

console.log('pool', poolIds.size, 'matched', Object.keys(byId).length)
console.log('top5', ordered.slice(0, 5).map(([id, r]) => `${id} #${r.rank} ${(r.usage * 100).toFixed(1)}%`))
console.log('mausholdfour', byId.mausholdfour)
console.log('garchomp', byId.garchomp)
console.log('wrote', outPath)
