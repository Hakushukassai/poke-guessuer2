import championsData from '../data/pokemon-champions.json'
import championsMonoData from '../data/pokemon-champions-mono.json'
import nationalData from '../data/pokemon-national.json'
import legendaryData from '../data/pokemon-legendary.json'
import startersData from '../data/pokemon-starters.json'
import spookyData from '../data/pokemon-spooky.json'
import type {
  DexCompareRecord,
  GuessRecord,
  PlayerId,
  Pokemon,
  PokemonType,
  ProbeRecord,
} from '../data/types'
import { EFFECTIVENESS_LABEL_JA } from '../data/types'
import {
  getCompetitiveMeta,
  matchesStatCompare,
  matchesTraitProbe,
  statCompareLabel,
  traitProbeLabel,
  type CompetitiveStatId,
  type CompetitiveTraitId,
  type StatCompareRecord,
  type TraitProbeRecord,
} from './competitive'
import { calcEffectiveness, matchesProbe } from './effectiveness'
import { preparePool } from './pokemonPool'

export type DexPool =
  | 'champions'
  | 'national'
  | 'legendary'
  | 'starters'
  | 'spooky'

/** Type-chart deduction vs battle-knowledge deduction. */
export type QuizMode = 'type' | 'type_dual' | 'competitive'

export const QUIZ_MODE_LABEL: Record<QuizMode, string> = {
  type: 'タイプ相性（全部）',
  type_dual: 'タイプ相性（複合のみ）',
  competitive: '対戦推理',
}

export const QUIZ_MODE_BLURB: Record<QuizMode, string> = {
  type: '単タイプ込みで相性と図鑑番号',
  type_dual: '複合タイプだけで相性と図鑑番号',
  competitive: '単タイプ込みで「設置ある？」',
}

export const POOL_ORDER: DexPool[] = [
  'champions',
  'national',
  'legendary',
  'starters',
  'spooky',
]

/** Primary pools shown up front on home. */
export const MAIN_POOLS: DexPool[] = ['champions', 'national']

/** Theme packs tucked behind a disclosure. */
export const THEME_POOLS: DexPool[] = ['legendary', 'starters', 'spooky']

export const DEFAULT_QUESTION_LIMIT = 8

export interface GameOptions {
  /** Each player bans 1 type before picks. */
  banEnabled: boolean
  /** Max type+dex questions per player; null = unlimited. */
  questionLimit: number | null
}

export const DEFAULT_OPTIONS: GameOptions = {
  banEnabled: false,
  questionLimit: null,
}

export function clampQuestionLimit(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_QUESTION_LIMIT
  return Math.min(18, Math.max(1, Math.floor(raw)))
}

export const POOL_LABEL: Record<DexPool, string> = {
  champions: 'チャンピオンズ',
  national: '全国図鑑',
  legendary: '伝説・幻',
  starters: '御三家',
  spooky: 'あく・ゴースト',
}

export const POOL_BLURB: Record<DexPool, string> = {
  champions: '対戦でよく見る顔ぶれ',
  national: '全国の単・複合タイプぜんぶ',
  legendary: '伝説・幻・パラドックスなど',
  starters: '御三家の最終進化',
  spooky: 'あくかゴーストを持つポケモン',
}

const championsDual = preparePool(championsData as Pokemon[])
const championsAll = preparePool([
  ...(championsData as Pokemon[]),
  ...(championsMonoData as Pokemon[]),
])
/** 対戦推理用: 複合 + 単タイプ（チャンピオンズ収録） */
const championsCompetitive = championsAll

const ALL_POOLS: Record<DexPool, Pokemon[]> = {
  champions: championsAll,
  national: preparePool(nationalData as Pokemon[]),
  legendary: preparePool(legendaryData as Pokemon[]),
  starters: preparePool(startersData as Pokemon[]),
  spooky: preparePool(spookyData as Pokemon[]),
}

const DUAL_POOLS: Record<DexPool, Pokemon[]> = {
  champions: championsDual,
  national: ALL_POOLS.national.filter((p) => p.types.length === 2),
  legendary: ALL_POOLS.legendary.filter((p) => p.types.length === 2),
  starters: ALL_POOLS.starters.filter((p) => p.types.length === 2),
  spooky: ALL_POOLS.spooky.filter((p) => p.types.length === 2),
}

/** @deprecated use pokemonIn(pool) — kept for tests defaulting to champions */
export const POKEMON = ALL_POOLS.champions

export function pokemonIn(
  pool: DexPool,
  quizMode: QuizMode = 'type',
): Pokemon[] {
  if (pool === 'champions' && quizMode === 'competitive') {
    return championsCompetitive
  }
  if (quizMode === 'type_dual') return DUAL_POOLS[pool]
  return ALL_POOLS[pool]
}

export function poolCounts(
  quizMode: QuizMode = 'type',
): Record<DexPool, number> {
  const pools = quizMode === 'type_dual' ? DUAL_POOLS : ALL_POOLS
  return {
    champions: pools.champions.length,
    national: pools.national.length,
    legendary: pools.legendary.length,
    starters: pools.starters.length,
    spooky: pools.spooky.length,
  }
}

export function competitiveChampionsCount(): number {
  return championsCompetitive.length
}

export type Phase =
  | 'home'
  | 'ban_p1'
  | 'handoff_ban_p2'
  | 'ban_p2'
  | 'handoff_pick_p1'
  | 'pick_p1'
  | 'handoff_p2'
  | 'pick_p2'
  | 'handoff_battle'
  | 'battle'
  | 'handoff_catchup'
  | 'catchup'
  | 'result'

export interface GameState {
  phase: Phase
  pool: DexPool
  quizMode: QuizMode
  names: { p1: string; p2: string }
  options: GameOptions
  /** Types banned from the shared pick pool (species with either type). */
  bannedTypes: PokemonType[]
  picks: { p1: string | null; p2: string | null }
  currentPlayer: PlayerId
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
  traitProbes: TraitProbeRecord[]
  statCompares: StatCompareRecord[]
  guesses: GuessRecord[]
  eliminated: { p1: string[]; p2: string[] }
  winner: PlayerId | null
  /** Both players guessed correctly on the catch-up reply. */
  draw: boolean
  lastMessage: string | null
}

export const DEFAULT_NAMES = { p1: 'サトシ', p2: 'タケシ' } as const

export function resolvePlayerName(raw: string, fallback: string): string {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export function resolveNames(input: {
  p1?: string
  p2?: string
}): { p1: string; p2: string } {
  return {
    p1: resolvePlayerName(input.p1 ?? '', DEFAULT_NAMES.p1),
    p2: resolvePlayerName(input.p2 ?? '', DEFAULT_NAMES.p2),
  }
}

export function initialState(): GameState {
  return {
    phase: 'home',
    pool: 'champions',
    quizMode: 'type',
    names: { ...DEFAULT_NAMES },
    options: { ...DEFAULT_OPTIONS },
    bannedTypes: [],
    picks: { p1: null, p2: null },
    currentPlayer: 'p1',
    probes: [],
    dexCompares: [],
    traitProbes: [],
    statCompares: [],
    guesses: [],
    eliminated: { p1: [], p2: [] },
    winner: null,
    draw: false,
    lastMessage: null,
  }
}

export function getPokemon(
  id: string,
  pool: DexPool = 'champions',
  quizMode: QuizMode = 'type',
): Pokemon | undefined {
  return pokemonIn(pool, quizMode).find((p) => p.id === id)
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1'
}

export function playerLabel(
  player: PlayerId,
  names: { p1: string; p2: string } = DEFAULT_NAMES,
): string {
  return names[player]
}

/** Probes asked ABOUT a target (i.e. by the opponent of that target's owner). */
export function probesAgainst(
  state: GameState,
  targetOwner: PlayerId,
): ProbeRecord[] {
  const asker = opponentOf(targetOwner)
  return state.probes.filter((p) => p.by === asker)
}

export function dexComparesBy(
  state: GameState,
  asker: PlayerId,
): DexCompareRecord[] {
  return state.dexCompares.filter((c) => c.by === asker)
}

export function traitProbesBy(
  state: GameState,
  asker: PlayerId,
): TraitProbeRecord[] {
  return state.traitProbes.filter((p) => p.by === asker)
}

export function statComparesBy(
  state: GameState,
  asker: PlayerId,
): StatCompareRecord[] {
  return state.statCompares.filter((c) => c.by === asker)
}

export function matchesDexCompare(
  pokemon: Pokemon,
  compare: DexCompareRecord,
): boolean {
  const num = pokemon.num ?? 0
  return compare.greater ? num > compare.pivotNum : num <= compare.pivotNum
}

export function questionUses(state: GameState, player: PlayerId): number {
  if (state.quizMode === 'competitive') {
    return (
      traitProbesBy(state, player).length + statComparesBy(state, player).length
    )
  }
  const probes = state.probes.filter((p) => p.by === player).length
  const dex = state.dexCompares.filter((c) => c.by === player).length
  return probes + dex
}

export function questionsRemaining(
  state: GameState,
  player: PlayerId,
): number | null {
  const limit = state.options.questionLimit
  if (limit == null) return null
  return Math.max(0, limit - questionUses(state, player))
}

export function canAskQuestion(state: GameState, player: PlayerId): boolean {
  const left = questionsRemaining(state, player)
  return left == null || left > 0
}

export function isTypeBanned(
  pokemon: Pokemon,
  bannedTypes: PokemonType[],
): boolean {
  if (bannedTypes.length === 0) return false
  const banned = new Set(bannedTypes)
  return pokemon.types.some((t) => banned.has(t))
}

export function filterCandidates(
  state: GameState,
  forPlayer: PlayerId,
): Pokemon[] {
  const targetOwner = opponentOf(forPlayer)
  const eliminated = new Set(state.eliminated[forPlayer])

  return pokemonIn(state.pool, state.quizMode).filter((poke) => {
    if (isTypeBanned(poke, state.bannedTypes)) return false
    if (eliminated.has(poke.id)) return false

    if (state.quizMode === 'competitive') {
      if (!getCompetitiveMeta(poke.id)) return false
      const traits = traitProbesBy(state, forPlayer)
      const stats = statComparesBy(state, forPlayer)
      if (!traits.every((probe) => matchesTraitProbe(poke, probe))) return false
      return stats.every((compare) => matchesStatCompare(poke, compare))
    }

    if (state.quizMode === 'type_dual' && poke.types.length !== 2) return false

    const probes = probesAgainst(state, targetOwner)
    const compares = dexComparesBy(state, forPlayer)
    if (
      !probes.every((probe) =>
        matchesProbe(poke, probe.moveType, probe.result),
      )
    ) {
      return false
    }
    return compares.every((compare) => matchesDexCompare(poke, compare))
  })
}

export type Action =
  | {
      type: 'START'
      pool: DexPool
      quizMode?: QuizMode
      names?: { p1?: string; p2?: string }
      options?: Partial<GameOptions>
    }
  | { type: 'BAN'; bannedType: PokemonType }
  | { type: 'PICK'; pokemonId: string }
  | { type: 'CONFIRM_HANDOFF' }
  | { type: 'PROBE'; moveType: PokemonType }
  | { type: 'DEX_COMPARE'; pivotId: string }
  | { type: 'TRAIT_PROBE'; traitId: CompetitiveTraitId }
  | { type: 'STAT_COMPARE'; pivotId: string; stat: CompetitiveStatId }
  | { type: 'GUESS'; pokemonId: string }
  | { type: 'RESET' }

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      const quizMode: QuizMode = action.quizMode ?? 'type'
      const pool: DexPool =
        quizMode === 'competitive' ? 'champions' : action.pool
      const options: GameOptions = {
        ...DEFAULT_OPTIONS,
        ...action.options,
      }
      if (options.questionLimit != null) {
        options.questionLimit = clampQuestionLimit(options.questionLimit)
      }
      return {
        ...initialState(),
        phase: options.banEnabled ? 'ban_p1' : 'pick_p1',
        pool,
        quizMode,
        names: resolveNames(action.names ?? {}),
        options,
      }
    }

    case 'RESET':
      return {
        ...initialState(),
        pool: state.pool,
        quizMode: state.quizMode,
        names: state.names,
        options: state.options,
      }

    case 'CONFIRM_HANDOFF': {
      if (state.phase === 'handoff_ban_p2') {
        return { ...state, phase: 'ban_p2', lastMessage: null }
      }
      if (state.phase === 'handoff_pick_p1') {
        return { ...state, phase: 'pick_p1', lastMessage: null }
      }
      if (state.phase === 'handoff_p2') {
        return { ...state, phase: 'pick_p2', lastMessage: null }
      }
      if (state.phase === 'handoff_battle') {
        return {
          ...state,
          phase: 'battle',
          currentPlayer: 'p1',
          lastMessage: null,
        }
      }
      if (state.phase === 'handoff_catchup') {
        return {
          ...state,
          phase: 'catchup',
          currentPlayer: 'p2',
          lastMessage: null,
        }
      }
      return state
    }

    case 'BAN': {
      if (!state.options.banEnabled) return state
      if (state.phase !== 'ban_p1' && state.phase !== 'ban_p2') return state
      if (state.bannedTypes.includes(action.bannedType)) return state

      const bannedTypes = [...state.bannedTypes, action.bannedType]
      const remain = pokemonIn(state.pool, state.quizMode).filter(
        (p) => !isTypeBanned(p, bannedTypes),
      ).length
      if (remain < 2) return state

      if (state.phase === 'ban_p1') {
        return {
          ...state,
          bannedTypes,
          phase: 'handoff_ban_p2',
          lastMessage: `【公開バン】${action.bannedType}タイプを禁止。${state.names.p2}に渡してください`,
        }
      }
      return {
        ...state,
        bannedTypes,
        phase: 'handoff_pick_p1',
        lastMessage: `【公開バン】${action.bannedType}タイプを禁止。選出は${state.names.p1}から`,
      }
    }

    case 'PICK': {
      const pick = getPokemon(action.pokemonId, state.pool, state.quizMode)
      if (!pick || isTypeBanned(pick, state.bannedTypes)) return state
      if (state.quizMode === 'type_dual' && pick.types.length !== 2) {
        return state
      }
      if (state.phase === 'pick_p1') {
        return {
          ...state,
          picks: { ...state.picks, p1: action.pokemonId },
          phase: 'handoff_p2',
          lastMessage: `${state.names.p2}に端末を渡してください`,
        }
      }
      if (state.phase === 'pick_p2') {
        return {
          ...state,
          picks: { ...state.picks, p2: action.pokemonId },
          phase: 'handoff_battle',
          lastMessage: `${state.names.p1}に端末を渡して対戦を開始します`,
        }
      }
      return state
    }

    case 'PROBE': {
      if (state.quizMode === 'competitive') return state
      if (state.phase !== 'battle' || !state.picks.p1 || !state.picks.p2) {
        return state
      }
      if (!canAskQuestion(state, state.currentPlayer)) return state

      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const target = getPokemon(targetId!, state.pool, state.quizMode)
      if (!target) return state

      const { label } = calcEffectiveness(action.moveType, target)
      const probe: ProbeRecord = {
        by: state.currentPlayer,
        moveType: action.moveType,
        result: label,
      }

      return {
        ...state,
        probes: [...state.probes, probe],
        currentPlayer: opponentOf(state.currentPlayer),
        lastMessage: `${action.moveType}タイプ → ${EFFECTIVENESS_LABEL_JA[label]}`,
      }
    }

    case 'DEX_COMPARE': {
      if (state.quizMode === 'competitive') return state
      if (state.phase !== 'battle' || !state.picks.p1 || !state.picks.p2) {
        return state
      }
      if (!canAskQuestion(state, state.currentPlayer)) return state

      const already = state.dexCompares.some(
        (c) =>
          c.by === state.currentPlayer && c.pivotId === action.pivotId,
      )
      if (already) return state

      const pivot = getPokemon(action.pivotId, state.pool, state.quizMode)
      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const target = getPokemon(targetId!, state.pool, state.quizMode)
      if (!pivot || !target || pivot.num == null || target.num == null) {
        return state
      }

      const greater = target.num > pivot.num
      const compare: DexCompareRecord = {
        by: state.currentPlayer,
        pivotId: pivot.id,
        pivotNum: pivot.num,
        greater,
      }

      return {
        ...state,
        dexCompares: [...state.dexCompares, compare],
        currentPlayer: opponentOf(state.currentPlayer),
        lastMessage: greater
          ? `#${pivot.num}より大きい`
          : `#${pivot.num}以下`,
      }
    }

    case 'TRAIT_PROBE': {
      if (state.quizMode !== 'competitive') return state
      if (state.phase !== 'battle' || !state.picks.p1 || !state.picks.p2) {
        return state
      }
      if (!canAskQuestion(state, state.currentPlayer)) return state

      const already = state.traitProbes.some(
        (p) =>
          p.by === state.currentPlayer && p.traitId === action.traitId,
      )
      if (already) return state

      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const target = getPokemon(targetId!, state.pool, state.quizMode)
      const meta = target ? getCompetitiveMeta(target.id) : undefined
      if (!target || !meta) return state

      const hasTrait = Boolean(meta.traits[action.traitId])
      const probe: TraitProbeRecord = {
        by: state.currentPlayer,
        traitId: action.traitId,
        hasTrait,
      }

      return {
        ...state,
        traitProbes: [...state.traitProbes, probe],
        currentPlayer: opponentOf(state.currentPlayer),
        lastMessage: traitProbeLabel(probe),
      }
    }

    case 'STAT_COMPARE': {
      if (state.quizMode !== 'competitive') return state
      if (state.phase !== 'battle' || !state.picks.p1 || !state.picks.p2) {
        return state
      }
      if (!canAskQuestion(state, state.currentPlayer)) return state

      const already = state.statCompares.some(
        (c) =>
          c.by === state.currentPlayer &&
          c.pivotId === action.pivotId &&
          c.stat === action.stat,
      )
      if (already) return state

      const pivot = getPokemon(action.pivotId, state.pool, state.quizMode)
      const pivotMeta = pivot ? getCompetitiveMeta(pivot.id) : undefined
      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const target = getPokemon(targetId!, state.pool, state.quizMode)
      const targetMeta = target ? getCompetitiveMeta(target.id) : undefined
      if (!pivot || !pivotMeta || !target || !targetMeta) return state

      const pivotValue = pivotMeta[action.stat]
      const greater = targetMeta[action.stat] > pivotValue
      const compare: StatCompareRecord = {
        by: state.currentPlayer,
        pivotId: pivot.id,
        stat: action.stat,
        pivotValue,
        greater,
      }

      return {
        ...state,
        statCompares: [...state.statCompares, compare],
        currentPlayer: opponentOf(state.currentPlayer),
        lastMessage: statCompareLabel(compare, pivot.name),
      }
    }

    case 'GUESS': {
      if (
        (state.phase !== 'battle' && state.phase !== 'catchup') ||
        !state.picks.p1 ||
        !state.picks.p2
      ) {
        return state
      }
      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const correct = action.pokemonId === targetId
      const guess: GuessRecord = {
        by: state.currentPlayer,
        pokemonId: action.pokemonId,
        correct,
      }

      // First player scores: second player gets one catch-up guess for a draw.
      if (correct && state.phase === 'battle' && state.currentPlayer === 'p1') {
        return {
          ...state,
          guesses: [...state.guesses, guess],
          phase: 'handoff_catchup',
          currentPlayer: 'p2',
          lastMessage: `${state.names.p1}が正解！${state.names.p2}も当てれば引き分け`,
        }
      }

      // Catch-up reply from second player.
      if (state.phase === 'catchup') {
        if (correct) {
          return {
            ...state,
            guesses: [...state.guesses, guess],
            winner: null,
            draw: true,
            phase: 'result',
            lastMessage: '引き分け！',
          }
        }
        return {
          ...state,
          guesses: [...state.guesses, guess],
          eliminated: {
            ...state.eliminated,
            p2: [...state.eliminated.p2, action.pokemonId],
          },
          winner: 'p1',
          draw: false,
          phase: 'result',
          lastMessage: `${state.names.p1}の勝ち`,
        }
      }

      if (correct) {
        return {
          ...state,
          guesses: [...state.guesses, guess],
          winner: state.currentPlayer,
          draw: false,
          phase: 'result',
          lastMessage: '正解！',
        }
      }

      return {
        ...state,
        guesses: [...state.guesses, guess],
        eliminated: {
          ...state.eliminated,
          [state.currentPlayer]: [
            ...state.eliminated[state.currentPlayer],
            action.pokemonId,
          ],
        },
        currentPlayer: opponentOf(state.currentPlayer),
        lastMessage: '不正解…',
      }
    }

    default:
      return state
  }
}
