import championsData from '../data/pokemon-champions.json'
import nationalData from '../data/pokemon-national.json'
import type {
  DexCompareRecord,
  GuessRecord,
  PlayerId,
  Pokemon,
  PokemonType,
  ProbeRecord,
} from '../data/types'
import { EFFECTIVENESS_LABEL_JA } from '../data/types'
import { calcEffectiveness, matchesProbe } from './effectiveness'
import { preparePool } from './pokemonPool'

export type DexPool = 'champions' | 'national'

export const POOL_LABEL: Record<DexPool, string> = {
  champions: 'チャンピオンズ',
  national: '全国図鑑',
}

const POOLS: Record<DexPool, Pokemon[]> = {
  champions: preparePool(championsData as Pokemon[]),
  national: preparePool(nationalData as Pokemon[]),
}

/** @deprecated use pokemonIn(pool) — kept for tests defaulting to champions */
export const POKEMON = POOLS.champions

export function pokemonIn(pool: DexPool): Pokemon[] {
  return POOLS[pool]
}

export function poolCounts(): Record<DexPool, number> {
  return {
    champions: POOLS.champions.length,
    national: POOLS.national.length,
  }
}

export type Phase =
  | 'home'
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
  names: { p1: string; p2: string }
  picks: { p1: string | null; p2: string | null }
  currentPlayer: PlayerId
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
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
    names: { ...DEFAULT_NAMES },
    picks: { p1: null, p2: null },
    currentPlayer: 'p1',
    probes: [],
    dexCompares: [],
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
): Pokemon | undefined {
  return pokemonIn(pool).find((p) => p.id === id)
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

export function matchesDexCompare(
  pokemon: Pokemon,
  compare: DexCompareRecord,
): boolean {
  const num = pokemon.num ?? 0
  return compare.greater ? num > compare.pivotNum : num <= compare.pivotNum
}

export function filterCandidates(
  state: GameState,
  forPlayer: PlayerId,
): Pokemon[] {
  const targetOwner = opponentOf(forPlayer)
  const probes = probesAgainst(state, targetOwner)
  const compares = dexComparesBy(state, forPlayer)
  const eliminated = new Set(state.eliminated[forPlayer])

  return pokemonIn(state.pool).filter((poke) => {
    if (eliminated.has(poke.id)) return false
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
  | { type: 'START'; pool: DexPool; names?: { p1?: string; p2?: string } }
  | { type: 'PICK'; pokemonId: string }
  | { type: 'CONFIRM_HANDOFF' }
  | { type: 'PROBE'; moveType: PokemonType }
  | { type: 'DEX_COMPARE'; pivotId: string }
  | { type: 'GUESS'; pokemonId: string }
  | { type: 'RESET' }

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return {
        ...initialState(),
        phase: 'pick_p1',
        pool: action.pool,
        names: resolveNames(action.names ?? {}),
      }

    case 'RESET':
      return {
        ...initialState(),
        pool: state.pool,
        names: state.names,
      }

    case 'CONFIRM_HANDOFF': {
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

    case 'PICK': {
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
      if (state.phase !== 'battle' || !state.picks.p1 || !state.picks.p2) {
        return state
      }
      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const target = getPokemon(targetId!, state.pool)
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
      if (state.phase !== 'battle' || !state.picks.p1 || !state.picks.p2) {
        return state
      }
      const already = state.dexCompares.some(
        (c) =>
          c.by === state.currentPlayer && c.pivotId === action.pivotId,
      )
      if (already) return state

      const pivot = getPokemon(action.pivotId, state.pool)
      const targetId = state.picks[opponentOf(state.currentPlayer)]
      const target = getPokemon(targetId!, state.pool)
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
