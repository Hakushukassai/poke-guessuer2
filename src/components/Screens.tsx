import { useEffect, useMemo, useState } from 'react'
import { TYPES, EFFECTIVENESS_LABEL_JA } from '../data/types'
import type {
  DexCompareRecord,
  EffectivenessLabel,
  PlayerId,
  Pokemon,
  PokemonType,
  ProbeRecord,
} from '../data/types'
import {
  DEFAULT_NAMES,
  POOL_LABEL,
  filterCandidates,
  getPokemon,
  opponentOf,
  playerLabel,
  pokemonIn,
  poolCounts,
  type DexPool,
  type GameState,
} from '../lib/game'
import { PokemonSprite } from './PokemonSprite'
import './screens.css'

const TYPE_COLORS: Record<string, string> = {
  ノーマル: '#a8a878',
  ほのお: '#f08030',
  みず: '#6890f0',
  でんき: '#f8d030',
  くさ: '#78c850',
  こおり: '#98d8d8',
  かくとう: '#c03028',
  どく: '#a040a0',
  じめん: '#e0c068',
  ひこう: '#a890f0',
  エスパー: '#f85888',
  むし: '#a8b820',
  いわ: '#b8a038',
  ゴースト: '#705898',
  ドラゴン: '#7038f8',
  あく: '#705848',
  はがね: '#b8b8d0',
  フェアリー: '#ee99ac',
}

const RESULT_MARK: Record<EffectivenessLabel, string> = {
  immune: '×',
  quarter: '▽▽',
  half: '▽',
  neutral: '－',
  super: '▲',
  double_super: '▲▲',
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="type-badge" style={{ background: TYPE_COLORS[type] ?? '#888' }}>
      {type}
    </span>
  )
}

function PlayerTag({
  player,
  names,
  suffix = '',
}: {
  player: PlayerId
  names: { p1: string; p2: string }
  suffix?: string
}) {
  return (
    <span className={`who-pill who-${player}`}>
      {playerLabel(player, names)}
      {suffix}
    </span>
  )
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="progress-dots" aria-label={`進行 ${step} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`dot ${i < step ? 'is-on' : ''}`} />
      ))}
      <span className="progress-label">
        {step}/{total}
      </span>
    </div>
  )
}

type FlashState =
  | { kind: 'probe'; moveType: PokemonType; result: EffectivenessLabel }
  | { kind: 'dex'; text: string }
  | { kind: 'miss'; name: string }
  | { kind: 'hit' }
  | null

function ActionFlash({ flash }: { flash: FlashState }) {
  if (!flash) return null
  if (flash.kind === 'probe') {
    return (
      <div className="flash-note visual" role="status">
        <span
          className="flash-type"
          style={{ background: TYPE_COLORS[flash.moveType] }}
        >
          {flash.moveType}
        </span>
        <span className="flash-arrow" aria-hidden>
          →
        </span>
        <span className={`flash-result result-${flash.result}`}>
          <span aria-hidden>{RESULT_MARK[flash.result]}</span>
          {EFFECTIVENESS_LABEL_JA[flash.result]}
        </span>
      </div>
    )
  }
  if (flash.kind === 'dex') {
    return (
      <div className="flash-note visual dex" role="status">
        図鑑 {flash.text}
      </div>
    )
  }
  if (flash.kind === 'miss') {
    return (
      <div className="flash-note miss" role="status">
        <span className="flash-x" aria-hidden>
          ×
        </span>
        {flash.name} はちがう
      </div>
    )
  }
  return (
    <div className="flash-note hit" role="status">
      正解！
    </div>
  )
}

function dexCompareLabel(compare: DexCompareRecord): string {
  return compare.greater
    ? `#${compare.pivotNum}より大きい`
    : `#${compare.pivotNum}以下`
}

function ClueBoard({
  probes,
  dexCompares,
  currentPlayer,
  names,
}: {
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
  currentPlayer: PlayerId
  names: { p1: string; p2: string }
}) {
  const [openOther, setOpenOther] = useState(false)

  const lanes = useMemo(() => {
    const all = [
      {
        target: 'p2' as const,
        asker: 'p1' as const,
        probes: probes.filter((p) => p.by === 'p1'),
        dex: dexCompares.filter((c) => c.by === 'p1'),
      },
      {
        target: 'p1' as const,
        asker: 'p2' as const,
        probes: probes.filter((p) => p.by === 'p2'),
        dex: dexCompares.filter((c) => c.by === 'p2'),
      },
    ]
    return [...all].sort((a, b) => {
      const af = a.asker === currentPlayer ? 0 : 1
      const bf = b.asker === currentPlayer ? 0 : 1
      return af - bf
    })
  }, [probes, dexCompares, currentPlayer])

  useEffect(() => {
    setOpenOther(false)
  }, [currentPlayer])

  return (
    <section className="clue-board" aria-label="相性メモ">
      <div className="clue-head">
        <h3>相性メモ</h3>
        <div className="result-legend" aria-label="記号の見方">
          <span>×無効</span>
          <span>▽いまひとつ</span>
          <span>－等倍</span>
          <span>▲ばつぐん</span>
        </div>
      </div>

      <div className="clue-lanes">
        {lanes.map((lane, index) => {
          const focusing = lane.asker === currentPlayer
          const collapsed = !focusing && !openOther
          const itemCount = lane.probes.length + lane.dex.length
          return (
            <article
              key={lane.target}
              className={`clue-lane lane-${lane.target} ${focusing ? 'is-focus' : ''} ${collapsed ? 'is-collapsed' : ''}`}
            >
              <header className="lane-head">
                <div className="lane-flow">
                  <span className={`lane-person asker-${lane.asker}`}>
                    {playerLabel(lane.asker, names)}
                    <small>が質問</small>
                  </span>
                  <span className="lane-flow-arrow" aria-hidden>
                    ▶
                  </span>
                  <span className={`lane-person target-${lane.target}`}>
                    <span className="mystery-ball" aria-hidden />
                    <span className="lane-person-text">
                      {playerLabel(lane.target, names)}
                      <small>のポケモン</small>
                    </span>
                  </span>
                </div>
                {focusing ? (
                  <span className="lane-now">いま絞る相手</span>
                ) : (
                  <button
                    type="button"
                    className="lane-toggle"
                    onClick={() => setOpenOther((v) => !v)}
                  >
                    {openOther ? 'とじる' : `相手メモ ${itemCount}`}
                  </button>
                )}
              </header>

              {!collapsed &&
                (itemCount === 0 ? (
                  <p className="lane-empty">
                    {focusing
                      ? 'まだ聞いていない。タイプか図鑑で絞ってね。'
                      : 'まだ質問なし'}
                  </p>
                ) : (
                  <ul className="clue-chips">
                    {lane.probes.map((probe, i) => (
                      <li key={`p-${probe.moveType}-${i}`} className="clue-chip">
                        <span
                          className="clue-type-block"
                          style={{ background: TYPE_COLORS[probe.moveType] }}
                        >
                          {probe.moveType}
                        </span>
                        <span className="clue-chip-arrow" aria-hidden>
                          →
                        </span>
                        <span
                          className={`clue-result-block result-${probe.result}`}
                        >
                          <span className="result-mark" aria-hidden>
                            {RESULT_MARK[probe.result]}
                          </span>
                          {EFFECTIVENESS_LABEL_JA[probe.result]}
                        </span>
                      </li>
                    ))}
                    {lane.dex.map((compare, i) => (
                      <li
                        key={`d-${compare.pivotId}-${i}`}
                        className="clue-chip clue-chip-dex"
                      >
                        <span className="clue-dex-block">
                          図鑑 {dexCompareLabel(compare)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}

              {collapsed && index === 1 && (
                <p className="lane-empty compact">
                  {itemCount === 0
                    ? '相手はまだ聞いていない'
                    : `${itemCount} 件（ひらいて確認）`}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export type PlayMode = 'local' | 'online'

export function HomeScreen({
  onStartLocal,
  onCreateOnline,
  onJoinOnline,
  initialNames,
}: {
  onStartLocal: (pool: DexPool, names: { p1: string; p2: string }) => void
  onCreateOnline: (pool: DexPool, name: string) => void
  onJoinOnline: (roomCode: string, name: string) => void
  initialNames?: { p1: string; p2: string }
}) {
  const [mode, setMode] = useState<PlayMode>('local')
  const [pool, setPool] = useState<DexPool>('champions')
  const [name1, setName1] = useState(
    initialNames && initialNames.p1 !== DEFAULT_NAMES.p1
      ? initialNames.p1
      : '',
  )
  const [name2, setName2] = useState(
    initialNames && initialNames.p2 !== DEFAULT_NAMES.p2
      ? initialNames.p2
      : '',
  )
  const [onlineName, setOnlineName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const counts = poolCounts()

  return (
    <section className="screen home-screen">
      <div className="home-stage">
        <p className="home-kicker">2人用 · 相性推理</p>
        <h1 className="brand">ポケ相性推理</h1>
        <p className="home-line">
          相手の複合タイプを、相性と図鑑番号で絞って当てる。
        </p>

        <div className="mode-switch" role="group" aria-label="プレイ方式">
          <button
            type="button"
            className={mode === 'local' ? 'is-on' : ''}
            onClick={() => setMode('local')}
          >
            同じ端末
          </button>
          <button
            type="button"
            className={mode === 'online' ? 'is-on' : ''}
            onClick={() => setMode('online')}
          >
            インターネット
          </button>
        </div>

        {mode === 'local' ? (
          <>
            <div className="name-fields" role="group" aria-label="プレイヤー名">
              <label className="name-field">
                <span>先攻</span>
                <input
                  type="text"
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="サトシ"
                  maxLength={12}
                  autoComplete="off"
                />
              </label>
              <label className="name-field">
                <span>後攻</span>
                <input
                  type="text"
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  placeholder="タケシ"
                  maxLength={12}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="pool-switch" role="group" aria-label="図鑑モード">
              <button
                type="button"
                className={pool === 'champions' ? 'is-on' : ''}
                onClick={() => setPool('champions')}
              >
                <strong>チャンピオンズ</strong>
                <span>{counts.champions} 体</span>
              </button>
              <button
                type="button"
                className={pool === 'national' ? 'is-on' : ''}
                onClick={() => setPool('national')}
              >
                <strong>全国図鑑</strong>
                <span>{counts.national} 体</span>
              </button>
            </div>

            <button
              type="button"
              className="btn primary big"
              onClick={() => onStartLocal(pool, { p1: name1, p2: name2 })}
            >
              {POOL_LABEL[pool]}ではじめる
            </button>
          </>
        ) : (
          <>
            <label className="name-field online-name">
              <span>あなたの名前</span>
              <input
                type="text"
                value={onlineName}
                onChange={(e) => setOnlineName(e.target.value)}
                placeholder="サトシ"
                maxLength={12}
                autoComplete="off"
              />
            </label>

            <div className="pool-switch" role="group" aria-label="図鑑モード">
              <button
                type="button"
                className={pool === 'champions' ? 'is-on' : ''}
                onClick={() => setPool('champions')}
              >
                <strong>チャンピオンズ</strong>
                <span>{counts.champions} 体</span>
              </button>
              <button
                type="button"
                className={pool === 'national' ? 'is-on' : ''}
                onClick={() => setPool('national')}
              >
                <strong>全国図鑑</strong>
                <span>{counts.national} 体</span>
              </button>
            </div>

            <button
              type="button"
              className="btn primary big"
              onClick={() => onCreateOnline(pool, onlineName)}
            >
              部屋をつくる
            </button>

            <div className="join-row">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="部屋コード"
                maxLength={6}
                autoComplete="off"
                aria-label="部屋コード"
              />
              <button
                type="button"
                className="btn"
                disabled={joinCode.trim().length < 4}
                onClick={() => onJoinOnline(joinCode.trim(), onlineName)}
              >
                参加
              </button>
            </div>
            <p className="online-note">
              別端末の相手に部屋コードを伝えてね。先に部屋をつくった人が先攻。
            </p>
          </>
        )}
      </div>

      <ol className="how-steps">
        <li>
          <span className="step-num">1</span>
          <div>
            <strong>秘密に1体ずつ選ぶ</strong>
            <p>複合タイプのみ。特性も相性に入ることがある</p>
          </div>
        </li>
        <li>
          <span className="step-num">2</span>
          <div>
            <strong>タイプや図鑑番号で絞る</strong>
            <p>相性の答えと、図鑑番号の大小がメモに残る</p>
          </div>
        </li>
        <li>
          <span className="step-num">3</span>
          <div>
            <strong>名前を当てたほうが勝ち</strong>
            <p>
              外れても続く。先攻が当てたら後攻にも1回チャンスがあり、両方正解なら引き分け
            </p>
          </div>
        </li>
      </ol>
    </section>
  )
}

export function WaitingPanel({
  title,
  detail,
  roomCode,
  onLeave,
}: {
  title: string
  detail?: string
  roomCode?: string
  onLeave?: () => void
}) {
  return (
    <section className="screen wait-screen">
      <div className="wait-card">
        <p className="wait-title">{title}</p>
        {detail && <p className="wait-detail">{detail}</p>}
        {roomCode && (
          <p className="room-code" aria-label="部屋コード">
            {roomCode}
          </p>
        )}
        {onLeave && (
          <button type="button" className="btn ghost" onClick={onLeave}>
            やめる
          </button>
        )}
      </div>
    </section>
  )
}

export function HandoffScreen({
  toPlayer,
  names,
  onConfirm,
  variant = 'normal',
}: {
  toPlayer: PlayerId
  names: { p1: string; p2: string }
  onConfirm: () => void
  variant?: 'normal' | 'catchup'
}) {
  const isCatchup = variant === 'catchup'
  return (
    <section className="screen handoff-screen">
      <div className={`handoff-curtain tone-${toPlayer}`}>
        <p className="handoff-label">
          {isCatchup ? '先行が正解' : 'つぎは'}
        </p>
        <p className={`handoff-who who-text-${toPlayer}`}>
          {playerLabel(toPlayer, names)}
        </p>
        <p className="handoff-hint">
          {isCatchup
            ? `当てられれば引き分け。外れれば${playerLabel('p1', names)}の勝ち。画面を渡してから下を押してね`
            : '画面を相手に見せないように渡してから、下を押してね'}
        </p>
        <button type="button" className="btn primary big" onClick={onConfirm}>
          {playerLabel(toPlayer, names)} が受け取った
        </button>
      </div>
    </section>
  )
}

export function PickScreen({
  player,
  pool,
  names,
  onPick,
}: {
  player: PlayerId
  pool: DexPool
  names: { p1: string; p2: string }
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<PokemonType | ''>('')
  const [selected, setSelected] = useState<Pokemon | null>(null)
  const roster = pokemonIn(pool)

  const list = useMemo(() => {
    const q = query.trim()
    return roster.filter((p) => {
      if (q && !p.name.includes(q)) return false
      if (typeFilter && !p.types.includes(typeFilter)) return false
      return true
    })
  }, [query, typeFilter, roster])

  const pickStep = player === 'p1' ? 1 : 2

  return (
    <section className={`screen pick-screen tone-${player}`}>
      <header className="screen-head">
        <div className="head-row">
          <PlayerTag player={player} names={names} />
          <ProgressDots step={pickStep} total={2} />
        </div>
        <h2>自分のポケモンを選ぶ</h2>
        <p className="lead">
          {POOL_LABEL[pool]} · 相手に見えないように選んで、下で確定。
        </p>
      </header>

      <div className="tool-row">
        <input
          type="search"
          placeholder="名前で探す"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="名前で探す"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as PokemonType | '')}
          aria-label="タイプで絞る"
        >
          <option value="">タイプ全部</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <p className="count-line">
        {list.length === 0 ? '見つからない' : `${list.length} 体`}
      </p>

      {list.length === 0 ? (
        <p className="empty-panel">検索条件を変えてみてね。</p>
      ) : (
        <div className={`poke-tray ${selected ? 'has-dock' : ''}`}>
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`poke-tile ${selected?.id === p.id ? 'is-selected' : ''}`}
              onClick={() => setSelected(p)}
            >
              <PokemonSprite pokemon={p} name={p.name} size={68} />
              <span className="poke-name">{p.name}</span>
              <span className="type-row">
                {p.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
              </span>
              {p.ability.affectsTypes && (
                <span className="ability-flag">{p.ability.name}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="dock">
          <PokemonSprite pokemon={selected} name={selected.name} size={52} />
          <div className="dock-text">
            <strong>{selected.name}</strong>
            <span className="type-row">
              {selected.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </span>
            <span className="dock-ability">
              特性 {selected.ability.name}
              {selected.ability.affectsTypes ? ' · 相性に影響' : ''}
            </span>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => onPick(selected.id)}
          >
            これに決める
          </button>
        </div>
      )}
    </section>
  )
}

export function BattleScreen({
  state,
  onProbe,
  onDexCompare,
  onGuess,
}: {
  state: GameState
  onProbe: (t: PokemonType) => void
  onDexCompare: (pivotId: string) => void
  onGuess: (id: string) => void
}) {
  const catchup = state.phase === 'catchup'
  const [mode, setMode] = useState<'probe' | 'dex' | 'guess'>(
    catchup ? 'guess' : 'probe',
  )
  const [query, setQuery] = useState('')
  const [pendingGuess, setPendingGuess] = useState<Pokemon | null>(null)
  const [pendingDex, setPendingDex] = useState<Pokemon | null>(null)
  const [flash, setFlash] = useState<FlashState>(null)

  const candidates = filterCandidates(state, state.currentPlayer)
  const roster = pokemonIn(state.pool)
  const targetOwner = opponentOf(state.currentPlayer)
  const remainPct = Math.round((candidates.length / roster.length) * 100)

  const visibleCandidates = useMemo(() => {
    const q = query.trim()
    return candidates.filter((p) => !q || p.name.includes(q))
  }, [candidates, query])

  const askedTypes = new Set(
    state.probes
      .filter((p) => p.by === state.currentPlayer)
      .map((p) => p.moveType),
  )

  const usedPivots = new Set(
    state.dexCompares
      .filter((c) => c.by === state.currentPlayer)
      .map((c) => c.pivotId),
  )

  useEffect(() => {
    if (!state.lastMessage) return
    const lastProbe = state.probes[state.probes.length - 1]
    const lastDex = state.dexCompares[state.dexCompares.length - 1]
    const lastGuess = state.guesses[state.guesses.length - 1]

    if (
      state.lastMessage.startsWith('正解') ||
      state.lastMessage.startsWith('引き分け')
    ) {
      setFlash({ kind: 'hit' })
    } else if (state.lastMessage.startsWith('不正解') && lastGuess) {
      const named = getPokemon(lastGuess.pokemonId, state.pool)
      setFlash({ kind: 'miss', name: named?.name ?? 'そのポケモン' })
    } else if (
      lastDex &&
      (state.lastMessage.includes('より大きい') ||
        state.lastMessage.includes('以下'))
    ) {
      setFlash({ kind: 'dex', text: state.lastMessage })
    } else if (lastProbe && state.lastMessage.includes('タイプ')) {
      setFlash({
        kind: 'probe',
        moveType: lastProbe.moveType,
        result: lastProbe.result,
      })
    } else {
      setFlash(null)
    }

    const t = window.setTimeout(() => setFlash(null), 2600)
    return () => window.clearTimeout(t)
  }, [state.probes, state.dexCompares, state.guesses, state.lastMessage])

  useEffect(() => {
    setMode(catchup ? 'guess' : 'probe')
    setQuery('')
    setPendingGuess(null)
    setPendingDex(null)
  }, [state.currentPlayer, catchup])

  const turnAsk = catchup
    ? '当てられれば引き分け'
    : mode === 'probe'
      ? 'どのタイプで聞く？'
      : mode === 'dex'
        ? 'どのポケモンと比べる？'
        : 'どれだと思う？'

  return (
    <section className={`screen battle-screen tone-${state.currentPlayer}`}>
      <header className="turn-banner">
        <div>
          <p className="who-pill pool-pill">{POOL_LABEL[state.pool]}</p>
          <PlayerTag
            player={state.currentPlayer}
            names={state.names}
            suffix=" の番"
          />
          <h2 className="turn-ask">{turnAsk}</h2>
          <p className="lead tight">
            {catchup
              ? `${playerLabel('p1', state.names)}が正解済み。今すぐ名前を当てて`
              : `当てるのは ${playerLabel(targetOwner, state.names)} の秘密ポケモン`}
          </p>
        </div>
        <div className="remain-box">
          <p className="remain">
            候補 <strong>{candidates.length}</strong>
            <span> / {roster.length}</span>
          </p>
          <div className="remain-bar" aria-hidden>
            <span style={{ width: `${remainPct}%` }} />
          </div>
        </div>
      </header>

      <ActionFlash flash={flash} />

      {!catchup && (
        <div className="action-switch three" role="tablist" aria-label="行動">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'probe'}
            className={mode === 'probe' ? 'is-on' : ''}
            onClick={() => setMode('probe')}
          >
            タイプを聞く
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'dex'}
            className={mode === 'dex' ? 'is-on' : ''}
            onClick={() => setMode('dex')}
          >
            図鑑で絞る
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'guess'}
            className={mode === 'guess' ? 'is-on' : ''}
            onClick={() => setMode('guess')}
          >
            名前を当てる
          </button>
        </div>
      )}

      {catchup && (
        <p className="catchup-banner" role="status">
          外れれば {playerLabel('p1', state.names)} の勝ち
        </p>
      )}

      {mode === 'probe' && !catchup ? (
        <div className="type-pad">
          {TYPES.map((t) => {
            const used = askedTypes.has(t)
            return (
              <button
                key={t}
                type="button"
                className={`type-stamp ${used ? 'is-used' : ''}`}
                style={{ ['--stamp' as string]: TYPE_COLORS[t] }}
                disabled={used}
                onClick={() => onProbe(t)}
              >
                <span>{t}</span>
                {used && <small>済</small>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="guess-pane">
          <div className="tool-row">
            <input
              type="search"
              placeholder="候補を名前で探す"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {mode === 'dex' && !catchup && (
            <p className="dex-hint">
              基準を選ぶと「図鑑番号はこれより大きい？」と聞ける
            </p>
          )}
          {visibleCandidates.length === 0 ? (
            <p className="empty-panel">
              条件に合う候補がない。相性メモを見直してみて。
            </p>
          ) : (
            <div className="poke-tray compact">
              {visibleCandidates.map((p) => {
                const used = mode === 'dex' && usedPivots.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`poke-tile ${used ? 'is-used' : ''}`}
                    disabled={used}
                    onClick={() =>
                      mode === 'dex' && !catchup
                        ? setPendingDex(p)
                        : setPendingGuess(p)
                    }
                  >
                    <PokemonSprite pokemon={p} name={p.name} size={60} />
                    <span className="poke-name">{p.name}</span>
                    {p.num != null && (
                      <span className="dex-num">#{p.num}</span>
                    )}
                    <span className="type-row">
                      {p.types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </span>
                    {used && <small className="tile-used">比較済</small>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <ClueBoard
        probes={state.probes}
        dexCompares={state.dexCompares}
        currentPlayer={state.currentPlayer}
        names={state.names}
      />

      {pendingDex && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => setPendingDex(null)}
        >
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="図鑑比較の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <PokemonSprite
              pokemon={pendingDex}
              name={pendingDex.name}
              size={96}
            />
            <p className="sheet-title">{pendingDex.name}</p>
            <span className="type-row center">
              {pendingDex.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </span>
            <p className="sheet-sub">
              相手の図鑑番号は #{pendingDex.num} より大きい？
              <br />
              聞くと相手の番になるよ。
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPendingDex(null)}
              >
                やめる
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onDexCompare(pendingDex.id)
                  setPendingDex(null)
                }}
              >
                聞く
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingGuess && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => setPendingGuess(null)}
        >
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="解答の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <PokemonSprite
              pokemon={pendingGuess}
              name={pendingGuess.name}
              size={96}
            />
            <p className="sheet-title">{pendingGuess.name}</p>
            <span className="type-row center">
              {pendingGuess.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </span>
            <p className="sheet-sub">
              {catchup
                ? 'これに解答する？ 当たれば引き分け、外すと先行の勝ち。'
                : 'これに解答する？ 外すと相手の番になるよ。'}
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPendingGuess(null)}
              >
                やめる
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onGuess(pendingGuess.id)
                  setPendingGuess(null)
                }}
              >
                解答する
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function ResultScreen({
  state,
  onReset,
}: {
  state: GameState
  onReset: () => void
}) {
  const p1 = getPokemon(state.picks.p1!, state.pool)
  const p2 = getPokemon(state.picks.p2!, state.pool)
  const misses = state.guesses.filter((g) => !g.correct).length

  return (
    <section className="screen result-screen">
      <p className="result-kicker">けっかはっぴょう · {POOL_LABEL[state.pool]}</p>
      <h2 className="result-win">
        {state.draw
          ? '引き分け'
          : `${playerLabel(state.winner!, state.names)} の勝ち`}
      </h2>

      <div className="reveal-row">
        <RevealBlock
          player="p1"
          names={state.names}
          pokemon={p1}
          winner={state.draw || state.winner === 'p1'}
          draw={state.draw}
        />
        <RevealBlock
          player="p2"
          names={state.names}
          pokemon={p2}
          winner={state.draw || state.winner === 'p2'}
          draw={state.draw}
        />
      </div>

      <p className="result-meta">
        質問 {state.probes.length} 回 · 外れ解答 {misses} 回
        {state.draw ? ' · 同時正解' : ''}
      </p>

      <button type="button" className="btn primary big" onClick={onReset}>
        もういちど
      </button>
    </section>
  )
}

function RevealBlock({
  player,
  names,
  pokemon,
  winner,
  draw = false,
}: {
  player: PlayerId
  names: { p1: string; p2: string }
  pokemon: Pokemon | undefined
  winner: boolean
  draw?: boolean
}) {
  if (!pokemon) return null
  return (
    <div className={`reveal-block ${winner ? 'is-winner' : ''} tone-${player}`}>
      <p className="reveal-label">
        <PlayerTag player={player} names={names} />
        {draw ? (
          <span className="win-flag">正解</span>
        ) : winner ? (
          <span className="win-flag">正解</span>
        ) : null}
      </p>
      <PokemonSprite pokemon={pokemon} name={pokemon.name} size={110} />
      <p className="poke-name">{pokemon.name}</p>
      <span className="type-row center">
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </span>
      <p className="dock-ability">
        特性 {pokemon.ability.name}
        {pokemon.ability.affectsTypes ? ' · 相性に影響' : ''}
      </p>
    </div>
  )
}
