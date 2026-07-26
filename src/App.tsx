import { useReducer, useState } from 'react'
import {
  BattleScreen,
  HandoffScreen,
  HomeScreen,
  PickScreen,
  ResultScreen,
} from './components/Screens'
import { OnlineSession, resolvedOnlineName } from './OnlineSession'
import {
  initialState,
  reducer,
  type DexPool,
} from './lib/game'
import { makeRoomCode } from './lib/partyHost'
import './App.css'

type Session =
  | { kind: 'home' }
  | { kind: 'local' }
  | {
      kind: 'online'
      roomCode: string
      name: string
      pool: DexPool
      isHost: boolean
    }

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [session, setSession] = useState<Session>({ kind: 'home' })

  if (session.kind === 'online') {
    return (
      <div className="app-shell">
        <OnlineSession
          roomCode={session.roomCode}
          displayName={session.name}
          pool={session.pool}
          isHost={session.isHost}
          onLeave={() => setSession({ kind: 'home' })}
        />
      </div>
    )
  }

  if (session.kind === 'home' || state.phase === 'home') {
    return (
      <div className="app-shell" key="home">
        <HomeScreen
          initialNames={state.names}
          onStartLocal={(pool, names) => {
            setSession({ kind: 'local' })
            dispatch({ type: 'START', pool, names })
          }}
          onCreateOnline={(pool, name) => {
            setSession({
              kind: 'online',
              roomCode: makeRoomCode(),
              name: resolvedOnlineName(name, true),
              pool,
              isHost: true,
            })
          }}
          onJoinOnline={(roomCode, name) => {
            setSession({
              kind: 'online',
              roomCode: roomCode.toUpperCase(),
              name: resolvedOnlineName(name, false),
              pool: 'champions',
              isHost: false,
            })
          }}
        />
      </div>
    )
  }

  return (
    <div className="app-shell" key={state.phase}>
      {state.phase === 'pick_p1' && (
        <PickScreen
          player="p1"
          pool={state.pool}
          names={state.names}
          onPick={(pokemonId) => dispatch({ type: 'PICK', pokemonId })}
        />
      )}

      {state.phase === 'handoff_p2' && (
        <HandoffScreen
          toPlayer="p2"
          names={state.names}
          onConfirm={() => dispatch({ type: 'CONFIRM_HANDOFF' })}
        />
      )}

      {state.phase === 'pick_p2' && (
        <PickScreen
          player="p2"
          pool={state.pool}
          names={state.names}
          onPick={(pokemonId) => dispatch({ type: 'PICK', pokemonId })}
        />
      )}

      {state.phase === 'handoff_battle' && (
        <HandoffScreen
          toPlayer="p1"
          names={state.names}
          onConfirm={() => dispatch({ type: 'CONFIRM_HANDOFF' })}
        />
      )}

      {state.phase === 'handoff_catchup' && (
        <HandoffScreen
          toPlayer="p2"
          names={state.names}
          variant="catchup"
          onConfirm={() => dispatch({ type: 'CONFIRM_HANDOFF' })}
        />
      )}

      {(state.phase === 'battle' || state.phase === 'catchup') && (
        <BattleScreen
          state={state}
          onProbe={(moveType) => dispatch({ type: 'PROBE', moveType })}
          onDexCompare={(pivotId) =>
            dispatch({ type: 'DEX_COMPARE', pivotId })
          }
          onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
        />
      )}

      {state.phase === 'result' && (
        <ResultScreen
          state={state}
          onReset={() => {
            dispatch({ type: 'RESET' })
            setSession({ kind: 'home' })
          }}
        />
      )}
    </div>
  )
}

export default App
