import type {
  DexCompareRecord,
  GuessRecord,
  PlayerId,
  PokemonType,
  ProbeRecord,
} from '../data/types'
import { EFFECTIVENESS_LABEL_JA } from '../data/types'
import { calcEffectiveness } from './effectiveness'
import {
  DEFAULT_NAMES,
  getPokemon,
  opponentOf,
  resolvePlayerName,
  type DexPool,
} from './game'

export type OnlinePhase =
  | 'lobby'
  | 'picking'
  | 'battle'
  | 'catchup'
  | 'result'

export interface OnlineRoomState {
  phase: OnlinePhase
  pool: DexPool
  names: { p1: string; p2: string }
  picks: { p1: string | null; p2: string | null }
  /** PartyKit connection ids seated as p1 / p2 */
  seatIds: { p1: string | null; p2: string | null }
  currentPlayer: PlayerId
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
  guesses: GuessRecord[]
  eliminated: { p1: string[]; p2: string[] }
  winner: PlayerId | null
  draw: boolean
  lastMessage: string | null
}

/** Per-connection public view (opponent pick hidden until result). */
export interface OnlineClientView {
  phase: OnlinePhase
  pool: DexPool
  names: { p1: string; p2: string }
  you: PlayerId | null
  seatIds: { p1: string | null; p2: string | null }
  myPick: string | null
  opponentPicked: boolean
  /** Full picks only when phase === 'result'; otherwise only your own id is filled. */
  picks: { p1: string | null; p2: string | null }
  currentPlayer: PlayerId
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
  guesses: GuessRecord[]
  eliminated: { p1: string[]; p2: string[] }
  winner: PlayerId | null
  draw: boolean
  lastMessage: string | null
}

export type ClientMessage =
  | { type: 'claim'; name?: string; pool?: DexPool }
  | { type: 'set_name'; name: string }
  | { type: 'set_pool'; pool: DexPool }
  | { type: 'pick'; pokemonId: string }
  | { type: 'probe'; moveType: PokemonType }
  | { type: 'dex_compare'; pivotId: string }
  | { type: 'guess'; pokemonId: string }
  | { type: 'play_again' }

export type ServerMessage =
  | { type: 'state'; view: OnlineClientView }
  | { type: 'error'; message: string }

export function createOnlineRoom(pool: DexPool = 'champions'): OnlineRoomState {
  return {
    phase: 'lobby',
    pool,
    names: { ...DEFAULT_NAMES },
    picks: { p1: null, p2: null },
    seatIds: { p1: null, p2: null },
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

export function seatOf(
  state: OnlineRoomState,
  connectionId: string,
): PlayerId | null {
  if (state.seatIds.p1 === connectionId) return 'p1'
  if (state.seatIds.p2 === connectionId) return 'p2'
  return null
}

export function toClientView(
  state: OnlineRoomState,
  you: PlayerId | null,
): OnlineClientView {
  const reveal = state.phase === 'result'
  const picks = reveal
    ? { ...state.picks }
    : {
        p1: you === 'p1' ? state.picks.p1 : null,
        p2: you === 'p2' ? state.picks.p2 : null,
      }

  return {
    phase: state.phase,
    pool: state.pool,
    names: state.names,
    you,
    seatIds: state.seatIds,
    myPick: you ? state.picks[you] : null,
    opponentPicked: you ? state.picks[opponentOf(you)] != null : false,
    picks,
    currentPlayer: state.currentPlayer,
    probes: state.probes,
    dexCompares: state.dexCompares,
    guesses: state.guesses,
    eliminated: state.eliminated,
    winner: state.winner,
    draw: state.draw,
    lastMessage: state.lastMessage,
  }
}

function bothSeated(state: OnlineRoomState): boolean {
  return state.seatIds.p1 != null && state.seatIds.p2 != null
}

function maybeStartPicking(state: OnlineRoomState): OnlineRoomState {
  if (state.phase === 'lobby' && bothSeated(state)) {
    return {
      ...state,
      phase: 'picking',
      lastMessage: '両者が揃った。ポケモンを選んでね',
    }
  }
  return state
}

function clearMatch(state: OnlineRoomState): OnlineRoomState {
  return {
    ...state,
    phase: bothSeated(state) ? 'picking' : 'lobby',
    picks: { p1: null, p2: null },
    currentPlayer: 'p1',
    probes: [],
    dexCompares: [],
    guesses: [],
    eliminated: { p1: [], p2: [] },
    winner: null,
    draw: false,
    lastMessage: bothSeated(state)
      ? 'もういちど選出から'
      : '相手の再接続を待っています',
  }
}

export function disconnectSeat(
  state: OnlineRoomState,
  connectionId: string,
): OnlineRoomState {
  const seat = seatOf(state, connectionId)
  if (!seat) return state

  const seatIds = { ...state.seatIds, [seat]: null }
  const next: OnlineRoomState = {
    ...state,
    seatIds,
    lastMessage: `${state.names[seat]}が切断しました`,
  }

  // If match in progress, freeze back to lobby until both reconnect.
  if (state.phase !== 'lobby' && state.phase !== 'result') {
    return {
      ...clearMatch(next),
      phase: 'lobby',
      seatIds,
      lastMessage: `${state.names[seat]}が切断したのでロビーに戻ります`,
    }
  }

  return next
}

export function applyClientMessage(
  state: OnlineRoomState,
  connectionId: string,
  msg: ClientMessage,
): { state: OnlineRoomState; error?: string } {
  switch (msg.type) {
    case 'claim': {
      let next = state
      let seat = seatOf(next, connectionId)
      if (!seat) {
        if (!next.seatIds.p1) seat = 'p1'
        else if (!next.seatIds.p2) seat = 'p2'
        else return { state, error: '部屋がいっぱいです' }

        next = {
          ...next,
          seatIds: { ...next.seatIds, [seat]: connectionId },
        }
      }

      const fallback = seat === 'p1' ? DEFAULT_NAMES.p1 : DEFAULT_NAMES.p2
      next = {
        ...next,
        names: {
          ...next.names,
          [seat]: resolvePlayerName(msg.name ?? '', fallback),
        },
      }

      // Host (first seater / p1) can set pool while in lobby
      if (seat === 'p1' && msg.pool && next.phase === 'lobby') {
        next = { ...next, pool: msg.pool }
      }

      return { state: maybeStartPicking(next) }
    }

    case 'set_name': {
      const seat = seatOf(state, connectionId)
      if (!seat) return { state, error: '席がありません' }
      const fallback = seat === 'p1' ? DEFAULT_NAMES.p1 : DEFAULT_NAMES.p2
      return {
        state: {
          ...state,
          names: {
            ...state.names,
            [seat]: resolvePlayerName(msg.name, fallback),
          },
        },
      }
    }

    case 'set_pool': {
      const seat = seatOf(state, connectionId)
      if (seat !== 'p1') return { state, error: '部屋主だけが図鑑を選べます' }
      if (state.phase !== 'lobby' && state.phase !== 'picking') {
        return { state, error: '対戦中は図鑑を変えられません' }
      }
      if (state.phase === 'picking' && (state.picks.p1 || state.picks.p2)) {
        return { state, error: '選出後は図鑑を変えられません' }
      }
      return { state: { ...state, pool: msg.pool } }
    }

    case 'pick': {
      const seat = seatOf(state, connectionId)
      if (!seat) return { state, error: '席がありません' }
      if (state.phase !== 'picking') return { state, error: '選出フェーズではありません' }
      if (!getPokemon(msg.pokemonId, state.pool)) {
        return { state, error: 'そのポケモンはこの図鑑にいません' }
      }
      if (state.picks[seat]) return { state, error: 'すでに選出済みです' }

      const picks = { ...state.picks, [seat]: msg.pokemonId }
      const bothPicked = picks.p1 != null && picks.p2 != null
      return {
        state: {
          ...state,
          picks,
          phase: bothPicked ? 'battle' : 'picking',
          currentPlayer: 'p1',
          lastMessage: bothPicked
            ? '対戦スタート！'
            : `${state.names[seat]}が選出完了。相手を待っています`,
        },
      }
    }

    case 'probe': {
      const seat = seatOf(state, connectionId)
      if (!seat) return { state, error: '席がありません' }
      if (state.phase !== 'battle') return { state, error: 'バトル中ではありません' }
      if (state.currentPlayer !== seat) return { state, error: 'あなたの番ではありません' }
      if (!state.picks.p1 || !state.picks.p2) return { state, error: '選出が未完了です' }

      const targetId = state.picks[opponentOf(seat)]!
      const target = getPokemon(targetId, state.pool)
      if (!target) return { state, error: '対象が見つかりません' }

      const { label } = calcEffectiveness(msg.moveType, target)
      const probe: ProbeRecord = {
        by: seat,
        moveType: msg.moveType,
        result: label,
      }
      return {
        state: {
          ...state,
          probes: [...state.probes, probe],
          currentPlayer: opponentOf(seat),
          lastMessage: `${msg.moveType}タイプ → ${EFFECTIVENESS_LABEL_JA[label]}`,
        },
      }
    }

    case 'dex_compare': {
      const seat = seatOf(state, connectionId)
      if (!seat) return { state, error: '席がありません' }
      if (state.phase !== 'battle') return { state, error: 'バトル中ではありません' }
      if (state.currentPlayer !== seat) return { state, error: 'あなたの番ではありません' }

      const already = state.dexCompares.some(
        (c) => c.by === seat && c.pivotId === msg.pivotId,
      )
      if (already) return { state, error: '同じ基準でもう聞いています' }

      const pivot = getPokemon(msg.pivotId, state.pool)
      const targetId = state.picks[opponentOf(seat)]
      const target = targetId ? getPokemon(targetId, state.pool) : undefined
      if (!pivot || !target || pivot.num == null || target.num == null) {
        return { state, error: '比較できません' }
      }

      const greater = target.num > pivot.num
      const compare: DexCompareRecord = {
        by: seat,
        pivotId: pivot.id,
        pivotNum: pivot.num,
        greater,
      }
      return {
        state: {
          ...state,
          dexCompares: [...state.dexCompares, compare],
          currentPlayer: opponentOf(seat),
          lastMessage: greater
            ? `#${pivot.num}より大きい`
            : `#${pivot.num}以下`,
        },
      }
    }

    case 'guess': {
      const seat = seatOf(state, connectionId)
      if (!seat) return { state, error: '席がありません' }
      if (state.phase !== 'battle' && state.phase !== 'catchup') {
        return { state, error: '解答フェーズではありません' }
      }
      if (state.currentPlayer !== seat) return { state, error: 'あなたの番ではありません' }
      if (!state.picks.p1 || !state.picks.p2) return { state, error: '選出が未完了です' }

      const targetId = state.picks[opponentOf(seat)]!
      const correct = msg.pokemonId === targetId
      const guess: GuessRecord = {
        by: seat,
        pokemonId: msg.pokemonId,
        correct,
      }

      if (correct && state.phase === 'battle' && seat === 'p1') {
        return {
          state: {
            ...state,
            guesses: [...state.guesses, guess],
            phase: 'catchup',
            currentPlayer: 'p2',
            lastMessage: `${state.names.p1}が正解！${state.names.p2}も当てれば引き分け`,
          },
        }
      }

      if (state.phase === 'catchup') {
        if (correct) {
          return {
            state: {
              ...state,
              guesses: [...state.guesses, guess],
              winner: null,
              draw: true,
              phase: 'result',
              lastMessage: '引き分け！',
            },
          }
        }
        return {
          state: {
            ...state,
            guesses: [...state.guesses, guess],
            eliminated: {
              ...state.eliminated,
              p2: [...state.eliminated.p2, msg.pokemonId],
            },
            winner: 'p1',
            draw: false,
            phase: 'result',
            lastMessage: `${state.names.p1}の勝ち`,
          },
        }
      }

      if (correct) {
        return {
          state: {
            ...state,
            guesses: [...state.guesses, guess],
            winner: seat,
            draw: false,
            phase: 'result',
            lastMessage: '正解！',
          },
        }
      }

      return {
        state: {
          ...state,
          guesses: [...state.guesses, guess],
          eliminated: {
            ...state.eliminated,
            [seat]: [...state.eliminated[seat], msg.pokemonId],
          },
          currentPlayer: opponentOf(seat),
          lastMessage: '不正解…',
        },
      }
    }

    case 'play_again': {
      const seat = seatOf(state, connectionId)
      if (!seat) return { state, error: '席がありません' }
      if (state.phase !== 'result') return { state, error: '結果画面ではありません' }
      return { state: clearMatch(state) }
    }

    default:
      return { state, error: '不明なメッセージです' }
  }
}
