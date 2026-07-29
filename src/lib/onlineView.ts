import type { PlayerId } from '../data/types'
import type { GameState } from './game'
import type { OnlineClientView } from './onlineRoom'

/** Adapt online view into the local GameState shape for existing screens. */
export function onlineViewToGameState(view: OnlineClientView): GameState {
  const phase =
    view.phase === 'battle'
      ? 'battle'
      : view.phase === 'catchup'
        ? 'catchup'
        : view.phase === 'result'
          ? 'result'
          : view.phase === 'picking'
            ? view.you === 'p1'
              ? 'pick_p1'
              : 'pick_p2'
            : 'home'

  return {
    phase,
    pool: view.pool,
    quizMode: view.quizMode,
    names: view.names,
    options: { banEnabled: false, questionLimit: null },
    bannedTypes: [],
    picks: {
      p1:
        view.picks.p1 ??
        (view.phase === 'result' && view.you === 'p1' ? view.myPick : null),
      p2:
        view.picks.p2 ??
        (view.phase === 'result' && view.you === 'p2' ? view.myPick : null),
    },
    currentPlayer: view.currentPlayer,
    probes: view.probes,
    dexCompares: view.dexCompares,
    evoProbes: view.evoProbes,
    traitProbes: [],
    statCompares: [],
    guesses: view.guesses,
    eliminated: view.eliminated,
    winner: view.winner,
    draw: view.draw,
    lastMessage: view.lastMessage,
  }
}

export function isMyTurn(view: OnlineClientView): boolean {
  if (!view.you) return false
  if (view.phase === 'battle' || view.phase === 'catchup') {
    return view.currentPlayer === view.you
  }
  return false
}

export function waitingCopy(view: OnlineClientView): string | null {
  if (!view.you) return '席の割り当て待ち…'
  if (view.phase === 'lobby') {
    return view.you === 'p1'
      ? '相手の参加を待っています'
      : '部屋主の準備を待っています'
  }
  if (view.phase === 'picking') {
    if (view.myPick && !view.opponentPicked) {
      return '相手の選出を待っています'
    }
    return null
  }
  if (view.phase === 'battle' || view.phase === 'catchup') {
    if (view.currentPlayer !== view.you) {
      return `${view.names[view.currentPlayer]} の番です`
    }
  }
  return null
}

export function otherPlayer(view: OnlineClientView): PlayerId | null {
  if (!view.you) return null
  return view.you === 'p1' ? 'p2' : 'p1'
}
