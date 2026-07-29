import { useEffect } from 'react'
import {
  BattleScreen,
  OnlinePickWaitScreen,
  OnlineWatchScreen,
  PickScreen,
  ResultScreen,
  WaitingPanel,
} from './components/Screens'
import type { DexPool, QuizMode } from './lib/game'
import { resolvePlayerName, DEFAULT_NAMES } from './lib/game'
import { onlineViewToGameState, waitingCopy } from './lib/onlineView'
import { useOnlineRoom } from './lib/useOnlineRoom'

export function OnlineSession({
  roomCode,
  displayName,
  pool,
  quizMode,
  isHost,
  onLeave,
}: {
  roomCode: string
  displayName: string
  pool: DexPool
  quizMode: QuizMode
  isHost: boolean
  onLeave: () => void
}) {
  const { view, error, connected, send, claim, clearError } = useOnlineRoom({
    roomCode,
    isHost,
    displayName,
    pool,
    quizMode,
  })

  useEffect(() => {
    claim({
      name: displayName,
      pool: isHost ? pool : undefined,
      quizMode: isHost ? quizMode : undefined,
    })
  }, [claim, displayName, pool, quizMode, isHost])

  if (!connected || !view || !view.you) {
    return (
      <WaitingPanel
        title={connected ? '席を確保しています…' : '接続中…'}
        detail={
          error ??
          (connected
            ? undefined
            : isHost
              ? 'PeerJS 経由で部屋を開いています…'
              : '部屋主のページを探しています…')
        }
        roomCode={roomCode}
        onLeave={onLeave}
      />
    )
  }

  const wait = waitingCopy(view)
  const gameState = onlineViewToGameState(view)

  if (view.phase === 'lobby') {
    return (
      <WaitingPanel
        title="相手を待っています"
        detail={
          view.you === 'p1'
            ? 'このコードを通話相手に伝えてね。あなたはこのタブを開いたままに'
            : `${view.names.p1} の部屋に入りました`
        }
        roomCode={roomCode}
        onLeave={onLeave}
      />
    )
  }

  if (view.phase === 'picking') {
    if (!view.myPick) {
      return (
        <PickScreen
          player={view.you}
          pool={view.pool}
          names={view.names}
          onPick={(pokemonId) => send({ type: 'pick', pokemonId })}
        />
      )
    }
    return (
      <OnlinePickWaitScreen
        view={view}
        roomCode={roomCode}
        onLeave={onLeave}
      />
    )
  }

  if (view.phase === 'result') {
    return (
      <ResultScreen
        state={gameState}
        onReset={() => send({ type: 'play_again' })}
      />
    )
  }

  if (wait && (view.phase === 'battle' || view.phase === 'catchup')) {
    return (
      <>
        {error && (
          <p className="online-error" role="alert">
            {error}
            <button type="button" onClick={clearError}>
              閉じる
            </button>
          </p>
        )}
        <OnlineWatchScreen view={view} roomCode={roomCode} onLeave={onLeave} />
      </>
    )
  }

  if (view.phase === 'battle' || view.phase === 'catchup') {
    return (
      <>
        {error && (
          <p className="online-error" role="alert">
            {error}
            <button type="button" onClick={clearError}>
              閉じる
            </button>
          </p>
        )}
        <BattleScreen
          state={gameState}
          onProbe={(moveType) => send({ type: 'probe', moveType })}
          onDexCompare={(pivotId) => send({ type: 'dex_compare', pivotId })}
          onTraitProbe={() => {}}
          onStatCompare={() => {}}
          onGuess={(pokemonId) => send({ type: 'guess', pokemonId })}
        />
      </>
    )
  }

  return (
    <WaitingPanel title="準備中…" roomCode={roomCode} onLeave={onLeave} />
  )
}

export function resolvedOnlineName(raw: string, isHost: boolean): string {
  return resolvePlayerName(
    raw,
    isHost ? DEFAULT_NAMES.p1 : DEFAULT_NAMES.p2,
  )
}
