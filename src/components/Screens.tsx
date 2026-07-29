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
  DEFAULT_QUESTION_LIMIT,
  MAIN_POOLS,
  POOL_BLURB,
  POOL_LABEL,
  QUIZ_MODE_BLURB,
  QUIZ_MODE_LABEL,
  THEME_POOLS,
  canAskQuestion,
  clampQuestionLimit,
  filterCandidates,
  getPokemon,
  isTypeBanned,
  opponentOf,
  playerLabel,
  pokemonIn,
  poolCounts,
  questionsRemaining,
  type DexPool,
  type GameOptions,
  type GameState,
  type QuizMode,
} from '../lib/game'
import {
  COMPETITIVE_STATS,
  COMPETITIVE_TRAIT_GROUPS,
  COMPETITIVE_TRAITS,
  getCompetitiveMeta,
  statAsk,
  statCompareLabel,
  traitAnswerMark,
  traitQuestion,
  type CompetitiveStatId,
  type CompetitiveTraitId,
  type StatCompareRecord,
  type TraitProbeRecord,
} from '../lib/competitive'
import {
  ROLE_FILTERS,
  filterAndSortCompetitivePick,
  formatUsagePercent,
  getPokemonUsage,
  usageSource,
  usageSpeedLine,
  type RoleFilter,
} from '../lib/usage'
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

/** タイプバンは双方公開。選出〜対戦まで常に明示する */
function BannedTypesBanner({
  bannedTypes,
  emptyHint = false,
}: {
  bannedTypes: PokemonType[]
  emptyHint?: boolean
}) {
  if (bannedTypes.length === 0) {
    if (!emptyHint) return null
    return (
      <aside className="ban-banner is-empty" aria-live="polite">
        <p className="ban-banner-label">公開バン</p>
        <p className="ban-banner-empty">まだ禁止タイプなし · 禁止は双方に見える</p>
      </aside>
    )
  }

  return (
    <aside className="ban-banner" aria-live="polite">
      <p className="ban-banner-label">公開バン · 禁止中</p>
      <div className="ban-banner-types">
        {bannedTypes.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <p className="ban-banner-note">このタイプを持つポケモンは誰も選べない</p>
    </aside>
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
  | { kind: 'trait'; text: string; yes: boolean }
  | { kind: 'stat'; text: string }
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
  if (flash.kind === 'trait') {
    return (
      <div
        className={`flash-note visual trait ${flash.yes ? 'is-yes' : 'is-no'}`}
        role="status"
      >
        <span className="flash-yn" aria-hidden>
          {flash.yes ? '○' : '×'}
        </span>
        <span className="flash-trait-text">{flash.text}</span>
      </div>
    )
  }
  if (flash.kind === 'stat') {
    return (
      <div className="flash-note visual dex" role="status">
        {flash.text}
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
  traitProbes = [],
  statCompares = [],
  quizMode,
  currentPlayer,
  names,
}: {
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
  traitProbes?: TraitProbeRecord[]
  statCompares?: StatCompareRecord[]
  quizMode: QuizMode
  currentPlayer: PlayerId
  names: { p1: string; p2: string }
}) {
  const competitive = quizMode === 'competitive'
  const [openOther, setOpenOther] = useState(false)

  const lanes = useMemo(() => {
    const all = [
      {
        target: 'p2' as const,
        asker: 'p1' as const,
        probes: probes.filter((p) => p.by === 'p1'),
        dex: dexCompares.filter((c) => c.by === 'p1'),
        traits: traitProbes.filter((p) => p.by === 'p1'),
        stats: statCompares.filter((c) => c.by === 'p1'),
      },
      {
        target: 'p1' as const,
        asker: 'p2' as const,
        probes: probes.filter((p) => p.by === 'p2'),
        dex: dexCompares.filter((c) => c.by === 'p2'),
        traits: traitProbes.filter((p) => p.by === 'p2'),
        stats: statCompares.filter((c) => c.by === 'p2'),
      },
    ]
    return [...all].sort((a, b) => {
      const af = a.asker === currentPlayer ? 0 : 1
      const bf = b.asker === currentPlayer ? 0 : 1
      return af - bf
    })
  }, [probes, dexCompares, traitProbes, statCompares, currentPlayer])

  useEffect(() => {
    setOpenOther(false)
  }, [currentPlayer])

  return (
    <section className="clue-board" aria-label={competitive ? '対戦メモ' : '相性メモ'}>
      <div className="clue-head">
        <h3>{competitive ? '対戦メモ' : '相性メモ'}</h3>
        {!competitive && (
          <div className="result-legend" aria-label="記号の見方">
            <span>×無効</span>
            <span>▽いまひとつ</span>
            <span>－等倍</span>
            <span>▲ばつぐん</span>
          </div>
        )}
        {competitive && (
          <div className="result-legend" aria-label="記号の見方">
            <span>○ はい</span>
            <span>× いいえ</span>
          </div>
        )}
      </div>

      <div className="clue-lanes">
        {lanes.map((lane, index) => {
          const focusing = lane.asker === currentPlayer
          const collapsed = !focusing && !openOther
          const itemCount = competitive
            ? lane.traits.length + lane.stats.length
            : lane.probes.length + lane.dex.length
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
                      ? competitive
                        ? 'まだ聞いていない。「設置ある？速い？」で絞ってね。'
                        : 'まだ聞いていない。タイプか図鑑で絞ってね。'
                      : 'まだ質問なし'}
                  </p>
                ) : (
                  <ul className="clue-chips">
                    {competitive
                      ? lane.traits.map((probe, i) => (
                          <li
                            key={`t-${probe.traitId}-${i}`}
                            className={`clue-chip clue-chip-yn ${probe.hasTrait ? 'is-yes' : 'is-no'}`}
                          >
                            <span className="clue-yn" aria-hidden>
                              {traitAnswerMark(probe.hasTrait)}
                            </span>
                            <span className="clue-dex-block">
                              {traitQuestion(probe.traitId)}
                            </span>
                          </li>
                        ))
                      : lane.probes.map((probe, i) => (
                          <li
                            key={`p-${probe.moveType}-${i}`}
                            className="clue-chip"
                          >
                            <span
                              className="clue-type-block"
                              style={{
                                background: TYPE_COLORS[probe.moveType],
                              }}
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
                    {competitive
                      ? lane.stats.map((compare, i) => {
                          const pivot = getPokemon(
                            compare.pivotId,
                            'champions',
                            'competitive',
                          )
                          return (
                            <li
                              key={`s-${compare.pivotId}-${compare.stat}-${i}`}
                              className="clue-chip clue-chip-dex"
                            >
                              <span className="clue-dex-block">
                                {statCompareLabel(compare, pivot?.name)}
                              </span>
                            </li>
                          )
                        })
                      : lane.dex.map((compare, i) => (
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

function PoolPicker({
  pool,
  onChange,
}: {
  pool: DexPool
  onChange: (pool: DexPool) => void
}) {
  const counts = poolCounts()
  const themeOpen = THEME_POOLS.includes(pool)

  return (
    <div className="pool-picker">
      <div className="pool-switch" role="group" aria-label="図鑑">
        {MAIN_POOLS.map((id) => (
          <button
            key={id}
            type="button"
            className={pool === id ? 'is-on' : ''}
            onClick={() => onChange(id)}
          >
            <strong>{POOL_LABEL[id]}</strong>
            <span>{counts[id]} 体</span>
          </button>
        ))}
      </div>

      <details className="flavor-drawer" {...(themeOpen ? { open: true } : {})}>
        <summary>お題パック（味変）</summary>
        <div
          className="pool-switch pack-grid"
          role="group"
          aria-label="お題パック"
        >
          {THEME_POOLS.map((id) => (
            <button
              key={id}
              type="button"
              className={pool === id ? 'is-on' : ''}
              onClick={() => onChange(id)}
            >
              <strong>{POOL_LABEL[id]}</strong>
              <span className="pack-count">{counts[id]} 体</span>
              <span className="pack-blurb">{POOL_BLURB[id]}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}

function FlavorOptions({
  options,
  onChange,
}: {
  options: GameOptions
  onChange: (next: GameOptions) => void
}) {
  const [limitDraft, setLimitDraft] = useState(
    String(options.questionLimit ?? DEFAULT_QUESTION_LIMIT),
  )

  return (
    <details className="flavor-drawer">
      <summary>ルール味変（任意）</summary>
      <div className="flavor-toggles">
        <label className="flavor-toggle">
          <input
            type="checkbox"
            checked={options.banEnabled}
            onChange={(e) =>
              onChange({ ...options, banEnabled: e.target.checked })
            }
          />
          <span>
            <strong>選出前タイプバン（公開）</strong>
            <small>各自1タイプを禁止。禁止タイプは双方に見え、そのタイプ持ちは誰も選べない</small>
          </span>
        </label>
        <label className="flavor-toggle">
          <input
            type="checkbox"
            checked={options.questionLimit != null}
            onChange={(e) => {
              if (e.target.checked) {
                const n = clampQuestionLimit(Number(limitDraft))
                setLimitDraft(String(n))
                onChange({ ...options, questionLimit: n })
              } else {
                onChange({ ...options, questionLimit: null })
              }
            }}
          />
          <span>
            <strong>質問上限</strong>
            <small>特徴＋種族値の合計。使い切ったら名指しのみ</small>
          </span>
        </label>
        {options.questionLimit != null && (
          <label className="limit-field">
            <span>上限回数（1〜18）</span>
            <input
              type="number"
              min={1}
              max={18}
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              onBlur={() => {
                const n = clampQuestionLimit(Number(limitDraft))
                setLimitDraft(String(n))
                onChange({ ...options, questionLimit: n })
              }}
            />
          </label>
        )}
      </div>
    </details>
  )
}

export function HomeScreen({
  onStartLocal,
  onCreateOnline,
  onJoinOnline,
  initialNames,
}: {
  onStartLocal: (
    pool: DexPool,
    names: { p1: string; p2: string },
    options: GameOptions,
    quizMode: QuizMode,
  ) => void
  onCreateOnline: (pool: DexPool, name: string) => void
  onJoinOnline: (roomCode: string, name: string) => void
  initialNames?: { p1: string; p2: string }
}) {
  const [mode, setMode] = useState<PlayMode>('local')
  const [quizMode, setQuizMode] = useState<QuizMode>('type')
  const [pool, setPool] = useState<DexPool>('champions')
  const [options, setOptions] = useState<GameOptions>({
    banEnabled: false,
    questionLimit: null,
  })
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

  const effectivePool = quizMode === 'competitive' ? 'champions' : pool

  return (
    <section className="screen home-screen">
      <div className="home-stage">
        <p className="home-kicker">2人用 · 秘密ポケモン推理</p>
        <h1 className="brand">ポケ相性推理</h1>
        <p className="home-line">
          {quizMode === 'competitive'
            ? '技・特性・速さで相手のポケモンを絞って当てる。'
            : '相手の複合タイプを、相性と図鑑番号で絞って当てる。'}
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

            <div className="quiz-mode-switch" role="group" aria-label="推理モード">
              {(['type', 'competitive'] as QuizMode[]).map((qm) => (
                <button
                  key={qm}
                  type="button"
                  className={quizMode === qm ? 'is-on' : ''}
                  onClick={() => {
                    setQuizMode(qm)
                    if (qm === 'competitive') setPool('champions')
                  }}
                >
                  <strong>{QUIZ_MODE_LABEL[qm]}</strong>
                  <small>{QUIZ_MODE_BLURB[qm]}</small>
                </button>
              ))}
            </div>

            {quizMode === 'type' ? (
              <PoolPicker pool={pool} onChange={setPool} />
            ) : (
              <p className="pool-locked">
                プールは <strong>チャンピオンズ</strong> 固定 · 複合＋単タイプ
              </p>
            )}
            <FlavorOptions options={options} onChange={setOptions} />

            <button
              type="button"
              className="btn primary big"
              onClick={() =>
                onStartLocal(
                  effectivePool,
                  { p1: name1, p2: name2 },
                  options,
                  quizMode,
                )
              }
            >
              {quizMode === 'competitive'
                ? '対戦推理ではじめる'
                : `${POOL_LABEL[effectivePool]}ではじめる`}
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

            <PoolPicker pool={pool} onChange={setPool} />
            <p className="online-note">
              ネット対戦はタイプ相性モードのみ。対戦推理は同じ端末で。
            </p>

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
            <p>
              {quizMode === 'competitive'
                ? 'チャンピオンズ（単タイプ含む）から選出。公開タイプバンや質問上限は任意'
                : '基本はチャンピオンズ／全国。公開タイプバンや質問上限は任意'}
            </p>
          </div>
        </li>
        <li>
          <span className="step-num">2</span>
          <div>
            <strong>
              {quizMode === 'competitive'
                ? 'できること・速さで絞る'
                : 'タイプや図鑑番号で絞る'}
            </strong>
            <p>
              {quizMode === 'competitive'
                ? '「設置ある？」「この子より速い？」の答えがメモに残る'
                : '相性の答えと、図鑑番号の大小がメモに残る'}
            </p>
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
  bannedTypes = [],
}: {
  toPlayer: PlayerId
  names: { p1: string; p2: string }
  onConfirm: () => void
  variant?: 'normal' | 'catchup'
  bannedTypes?: PokemonType[]
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
        {bannedTypes.length > 0 && (
          <div className="handoff-ban">
            <p className="handoff-ban-label">公開バン · 禁止中</p>
            <div className="ban-banner-types">
              {bannedTypes.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
          </div>
        )}
        <p className="handoff-hint">
          {isCatchup
            ? `当てられれば引き分け。外れれば${playerLabel('p1', names)}の勝ち。画面を渡してから下を押してね`
            : bannedTypes.length > 0
              ? '禁止タイプは公開。秘密の選出・推理だけ相手に見せないように渡してから、下を押してね'
              : '画面を相手に見せないように渡してから、下を押してね'}
        </p>
        <button type="button" className="btn primary big" onClick={onConfirm}>
          {playerLabel(toPlayer, names)} が受け取った
        </button>
      </div>
    </section>
  )
}

export function BanTypeScreen({
  player,
  pool,
  names,
  bannedTypes,
  quizMode = 'type',
  onBan,
}: {
  player: PlayerId
  pool: DexPool
  names: { p1: string; p2: string }
  bannedTypes: PokemonType[]
  quizMode?: QuizMode
  onBan: (t: PokemonType) => void
}) {
  const roster = pokemonIn(pool, quizMode)
  const pickStep = player === 'p1' ? 1 : 2
  const already = new Set(bannedTypes)

  return (
    <section className={`screen pick-screen tone-${player}`}>
      <header className="screen-head">
        <div className="head-row">
          <PlayerTag player={player} names={names} />
          <ProgressDots step={pickStep} total={2} />
        </div>
        <h2>公開バン · 1タイプ禁止</h2>
        <p className="lead">
          {POOL_LABEL[pool]} · 禁止は双方に見える。そのタイプ持ちは誰も選べない
        </p>
      </header>

      <BannedTypesBanner bannedTypes={bannedTypes} emptyHint />

      <div className="type-pad">
        {TYPES.map((t) => {
          const used = already.has(t)
          const remainIfBan = roster.filter(
            (p) => !isTypeBanned(p, [...bannedTypes, t]),
          ).length
          const tooFew = remainIfBan < 2
          return (
            <button
              key={t}
              type="button"
              className={`type-stamp ${used || tooFew ? 'is-used' : ''} ${used ? 'is-banned' : ''}`}
              style={{ ['--stamp' as string]: TYPE_COLORS[t] }}
              disabled={used || tooFew}
              onClick={() => onBan(t)}
            >
              <span>{t}</span>
              {used ? (
                <small>禁止</small>
              ) : tooFew ? (
                <small>残少</small>
              ) : (
                <small>{remainIfBan}</small>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function PickScreen({
  player,
  pool,
  names,
  bannedTypes = [],
  quizMode = 'type',
  onPick,
}: {
  player: PlayerId
  pool: DexPool
  names: { p1: string; p2: string }
  bannedTypes?: PokemonType[]
  quizMode?: QuizMode
  onPick: (id: string) => void
}) {
  const competitive = quizMode === 'competitive'
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<PokemonType | ''>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('常用')
  const [selected, setSelected] = useState<Pokemon | null>(null)
  const roster = pokemonIn(pool, quizMode)

  const list = useMemo(() => {
    if (competitive) {
      return filterAndSortCompetitivePick(roster, {
        query,
        typeFilter,
        roleFilter,
        isBanned: (p) => isTypeBanned(p, bannedTypes),
      })
    }
    const q = query.trim()
    return roster.filter((p) => {
      if (isTypeBanned(p, bannedTypes)) return false
      if (q && !p.name.includes(q)) return false
      if (typeFilter && !p.types.includes(typeFilter)) return false
      return true
    })
  }, [query, typeFilter, roleFilter, roster, bannedTypes, competitive])

  const selectedUsage = selected ? getPokemonUsage(selected.id) : undefined
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
          {POOL_LABEL[pool]}
          {competitive ? '（単タイプ含む）' : ''} ·
          相手に見えないように選んで、下で確定。
        </p>
      </header>

      <BannedTypesBanner bannedTypes={bannedTypes} />

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
          {TYPES.map((t) => {
            const banned = bannedTypes.includes(t)
            return (
              <option key={t} value={t} disabled={banned}>
                {banned ? `${t}（禁止）` : t}
              </option>
            )
          })}
        </select>
      </div>

      {competitive && (
        <div className="role-filters" role="group" aria-label="役割で絞る">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`role-chip ${roleFilter === f.id ? 'is-active' : ''}`}
              onClick={() => setRoleFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <p className="count-line">
        {list.length === 0
          ? '見つからない'
          : competitive
            ? `${list.length} 体 · 使用率順`
            : `${list.length} 体`}
      </p>

      {list.length === 0 ? (
        <p className="empty-panel">検索条件を変えてみてね。</p>
      ) : (
        <div className={`poke-tray ${selected ? 'has-dock' : ''}`}>
          {list.map((p) => {
            const usage = competitive ? getPokemonUsage(p.id) : undefined
            const speed = competitive ? usageSpeedLine(p.id) : null
            return (
              <button
                key={p.id}
                type="button"
                className={`poke-tile ${selected?.id === p.id ? 'is-selected' : ''} ${competitive ? 'is-meta' : ''}`}
                onClick={() => setSelected(p)}
              >
                {competitive && (
                  <span
                    className={`usage-badge ${usage ? '' : 'is-out'}`}
                  >
                    {formatUsagePercent(usage?.usage)}
                  </span>
                )}
                <PokemonSprite pokemon={p} name={p.name} size={68} />
                <span className="poke-name">{p.name}</span>
                <span className="type-row">
                  {p.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
                {competitive && usage && usage.roles.length > 0 && (
                  <span className="role-row">
                    {usage.roles.slice(0, 2).map((r) => (
                      <span
                        key={r}
                        className={`role-pill role-${r}`}
                      >
                        {r}
                      </span>
                    ))}
                  </span>
                )}
                {competitive && speed && (
                  <span className="speed-line">{speed}</span>
                )}
                {!competitive && p.ability.affectsTypes && (
                  <span className="ability-flag">{p.ability.name}</span>
                )}
              </button>
            )
          })}
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
            {competitive && selectedUsage ? (
              <>
                <span className="dock-meta">
                  {formatUsagePercent(selectedUsage.usage)}
                  {(() => {
                    const spd = usageSpeedLine(selected.id)
                    return spd ? ` · ${spd}` : ''
                  })()}
                </span>
                {selectedUsage.blurb && (
                  <span className="dock-blurb">{selectedUsage.blurb}</span>
                )}
                {selectedUsage.topMoves.length > 0 && (
                  <span className="dock-moves">
                    定番技{' '}
                    {selectedUsage.topMoves.map((m) => m.name).join(' · ')}
                  </span>
                )}
                {selectedUsage.topItem && (
                  <span className="dock-item">
                    持ち物 {selectedUsage.topItem.name}
                  </span>
                )}
              </>
            ) : (
              <span className="dock-ability">
                特性 {selected.ability.name}
                {selected.ability.affectsTypes ? ' · 相性に影響' : ''}
              </span>
            )}
            {competitive && !selectedUsage && (
              <span className="dock-ability">
                使用率データなし · 特性 {selected.ability.name}
              </span>
            )}
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

      {competitive && (
        <p className="usage-footnote">
          使用率: {usageSource().label}
        </p>
      )}
    </section>
  )
}

export function BattleScreen({
  state,
  onProbe,
  onDexCompare,
  onTraitProbe,
  onStatCompare,
  onGuess,
}: {
  state: GameState
  onProbe: (t: PokemonType) => void
  onDexCompare: (pivotId: string) => void
  onTraitProbe: (traitId: CompetitiveTraitId) => void
  onStatCompare: (pivotId: string, stat: CompetitiveStatId) => void
  onGuess: (id: string) => void
}) {
  const competitive = state.quizMode === 'competitive'
  const catchup = state.phase === 'catchup'
  const askLeft = questionsRemaining(state, state.currentPlayer)
  const canAsk = canAskQuestion(state, state.currentPlayer)
  type BattleTab = 'probe' | 'dex' | 'trait' | 'stat' | 'guess'
  const defaultTab: BattleTab = catchup || !canAsk
    ? 'guess'
    : competitive
      ? 'trait'
      : 'probe'
  const [mode, setMode] = useState<BattleTab>(defaultTab)
  const [query, setQuery] = useState('')
  const [pendingGuess, setPendingGuess] = useState<Pokemon | null>(null)
  const [pendingDex, setPendingDex] = useState<Pokemon | null>(null)
  const [pendingStat, setPendingStat] = useState<Pokemon | null>(null)
  const [statKind, setStatKind] = useState<CompetitiveStatId>('speed')
  const [flash, setFlash] = useState<FlashState>(null)

  const candidates = filterCandidates(state, state.currentPlayer)
  const roster = pokemonIn(state.pool, state.quizMode)
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

  const askedTraits = new Set(
    state.traitProbes
      .filter((p) => p.by === state.currentPlayer)
      .map((p) => p.traitId),
  )

  const usedStatKeys = new Set(
    state.statCompares
      .filter((c) => c.by === state.currentPlayer)
      .map((c) => `${c.stat}:${c.pivotId}`),
  )

  useEffect(() => {
    if (!state.lastMessage) return
    const lastProbe = state.probes[state.probes.length - 1]
    const lastDex = state.dexCompares[state.dexCompares.length - 1]
    const lastTrait = state.traitProbes[state.traitProbes.length - 1]
    const lastStat = state.statCompares[state.statCompares.length - 1]
    const lastGuess = state.guesses[state.guesses.length - 1]

    if (
      state.lastMessage.startsWith('正解') ||
      state.lastMessage.startsWith('引き分け')
    ) {
      setFlash({ kind: 'hit' })
    } else if (state.lastMessage.startsWith('不正解') && lastGuess) {
      const named = getPokemon(
        lastGuess.pokemonId,
        state.pool,
        state.quizMode,
      )
      setFlash({ kind: 'miss', name: named?.name ?? 'そのポケモン' })
    } else if (lastTrait && state.lastMessage.includes('？')) {
      setFlash({
        kind: 'trait',
        text: traitQuestion(lastTrait.traitId),
        yes: lastTrait.hasTrait,
      })
    } else if (
      lastStat &&
      (state.lastMessage.includes('速い') ||
        state.lastMessage.includes('遅い') ||
        state.lastMessage.includes('種族値'))
    ) {
      setFlash({ kind: 'stat', text: state.lastMessage })
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
  }, [
    state.probes,
    state.dexCompares,
    state.traitProbes,
    state.statCompares,
    state.guesses,
    state.lastMessage,
    state.pool,
  ])

  useEffect(() => {
    setMode(
      catchup || !canAskQuestion(state, state.currentPlayer)
        ? 'guess'
        : competitive
          ? 'trait'
          : 'probe',
    )
    setQuery('')
    setPendingGuess(null)
    setPendingDex(null)
    setPendingStat(null)
  }, [
    state.currentPlayer,
    catchup,
    competitive,
    state.probes.length,
    state.dexCompares.length,
    state.traitProbes.length,
    state.statCompares.length,
    state.options.questionLimit,
  ])

  const turnAsk = catchup
    ? '当てられれば引き分け'
    : !canAsk
      ? '質問回数を使い切った。名前を当てて'
      : mode === 'probe'
        ? 'どのタイプで聞く？'
        : mode === 'dex'
          ? 'どのポケモンと比べる？'
          : mode === 'trait'
            ? '相手に聞けること'
            : mode === 'stat'
              ? '基準のポケモンを選ぶ'
              : 'どれだと思う？'

  const showTraitPad = mode === 'trait' && !catchup && canAsk
  const showTypePad = mode === 'probe' && !catchup && canAsk && !competitive
  const showList =
    !showTraitPad &&
    !showTypePad &&
    (mode === 'guess' ||
      mode === 'dex' ||
      mode === 'stat' ||
      catchup ||
      !canAsk)

  return (
    <section className={`screen battle-screen tone-${state.currentPlayer}`}>
      <header className="turn-banner">
        <div>
          <p className="who-pill pool-pill">
            {competitive
              ? `${POOL_LABEL[state.pool]} · 対戦推理`
              : POOL_LABEL[state.pool]}
          </p>
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
            {askLeft != null && !catchup
              ? ` · 質問あと ${askLeft} 回`
              : ''}
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

      <BannedTypesBanner bannedTypes={state.bannedTypes} />

      <ActionFlash flash={flash} />

      <div className="battle-body">
        <div className="battle-main">
      {!catchup && (
        <div className="action-switch three" role="tablist" aria-label="行動">
          {competitive ? (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'trait'}
                className={mode === 'trait' ? 'is-on' : ''}
                disabled={!canAsk}
                onClick={() => canAsk && setMode('trait')}
              >
                できること
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'stat'}
                className={mode === 'stat' ? 'is-on' : ''}
                disabled={!canAsk}
                onClick={() => canAsk && setMode('stat')}
              >
                速さ比べ
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'probe'}
                className={mode === 'probe' ? 'is-on' : ''}
                disabled={!canAsk}
                onClick={() => canAsk && setMode('probe')}
              >
                タイプを聞く
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'dex'}
                className={mode === 'dex' ? 'is-on' : ''}
                disabled={!canAsk}
                onClick={() => canAsk && setMode('dex')}
              >
                図鑑で絞る
              </button>
            </>
          )}
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

      {!canAsk && !catchup && (
        <p className="catchup-banner" role="status">
          質問上限に達したので名指しのみ
        </p>
      )}

      {showTypePad && (
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
      )}

      {showTraitPad && (
        <div className="trait-panels">
          <p className="ask-guide">
            はい／いいえで候補が減る。まずは設置・交代・特性からが決まりやすい。
          </p>
          {COMPETITIVE_TRAIT_GROUPS.map((group) => {
            const traits = COMPETITIVE_TRAITS.filter((t) => t.group === group.id)
            if (traits.length === 0) return null
            return (
              <section key={group.id} className={`trait-group group-${group.id}`}>
                <header className="trait-group-head">
                  <h3>{group.title}</h3>
                  <p>{group.blurb}</p>
                </header>
                <div className="trait-pad">
                  {traits.map((trait) => {
                    const used = askedTraits.has(trait.id)
                    return (
                      <button
                        key={trait.id}
                        type="button"
                        className={`trait-stamp tone-${trait.group} ${used ? 'is-used' : ''}`}
                        disabled={used}
                        onClick={() => onTraitProbe(trait.id)}
                      >
                        <span className="trait-q">{trait.question}</span>
                        <small>{used ? 'もう聞いた' : trait.examples}</small>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {showList && (
        <div className="guess-pane">
          {mode === 'stat' && !catchup && canAsk && (
            <div className="stat-switch" role="group" aria-label="比べ方">
              {COMPETITIVE_STATS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={statKind === s.id ? 'is-on' : ''}
                  onClick={() => setStatKind(s.id)}
                >
                  {s.id === 'speed' ? '速さ' : '種族値'}
                </button>
              ))}
            </div>
          )}
          <div className="tool-row">
            <input
              type="search"
              placeholder="候補を名前で探す"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {mode === 'dex' && !catchup && canAsk && (
            <p className="dex-hint">
              基準を選ぶと「図鑑番号はこれより大きい？」と聞ける
            </p>
          )}
          {mode === 'stat' && !catchup && canAsk && (
            <p className="dex-hint">{statAsk(statKind)}</p>
          )}
          {visibleCandidates.length === 0 ? (
            <p className="empty-panel">
              条件に合う候補がない。メモを見直してみて。
            </p>
          ) : (
            <div className="poke-tray compact">
              {visibleCandidates.map((p) => {
                const usedDex = mode === 'dex' && usedPivots.has(p.id)
                const usedStat =
                  mode === 'stat' && usedStatKeys.has(`${statKind}:${p.id}`)
                const used = usedDex || usedStat
                const meta = competitive ? getCompetitiveMeta(p.id) : undefined
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`poke-tile ${used ? 'is-used' : ''}`}
                    disabled={used}
                    onClick={() => {
                      if (mode === 'dex' && !catchup) setPendingDex(p)
                      else if (mode === 'stat' && !catchup) setPendingStat(p)
                      else setPendingGuess(p)
                    }}
                  >
                    <PokemonSprite pokemon={p} name={p.name} size={60} />
                    <span className="poke-name">{p.name}</span>
                    {mode === 'stat' && meta ? (
                      <span className="dex-num">
                        {statKind === 'speed'
                          ? `速さ ${meta.speed}`
                          : `合計 ${meta.bst}`}
                      </span>
                    ) : (
                      p.num != null && (
                        <span className="dex-num">#{p.num}</span>
                      )
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
        </div>

      <ClueBoard
        probes={state.probes}
        dexCompares={state.dexCompares}
        traitProbes={state.traitProbes}
        statCompares={state.statCompares}
        quizMode={state.quizMode}
        currentPlayer={state.currentPlayer}
        names={state.names}
      />
      </div>

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

      {pendingStat && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => setPendingStat(null)}
        >
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="種族値比較の確認"
            onClick={(e) => e.stopPropagation()}
          >
            <PokemonSprite
              pokemon={pendingStat}
              name={pendingStat.name}
              size={96}
            />
            <p className="sheet-title">{pendingStat.name}</p>
            <span className="type-row center">
              {pendingStat.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </span>
            <p className="sheet-sub">
              {statAsk(statKind)}
              <br />
              基準は {pendingStat.name}
              （
              {statKind === 'speed' ? '速さ' : '合計'}{' '}
              {getCompetitiveMeta(pendingStat.id)?.[statKind] ?? '?'}）
              <br />
              聞くと相手の番になるよ。
            </p>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setPendingStat(null)}
              >
                やめる
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onStatCompare(pendingStat.id, statKind)
                  setPendingStat(null)
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
  const p1 = getPokemon(state.picks.p1!, state.pool, state.quizMode)
  const p2 = getPokemon(state.picks.p2!, state.pool, state.quizMode)
  const misses = state.guesses.filter((g) => !g.correct).length

  return (
    <section className="screen result-screen">
      <p className="result-kicker">
        けっかはっぴょう · {POOL_LABEL[state.pool]}
        {state.quizMode === 'competitive' ? ' · 対戦推理' : ''}
      </p>
      <h2 className="result-win">
        {state.draw
          ? '引き分け'
          : `${playerLabel(state.winner!, state.names)} の勝ち`}
      </h2>

      <BannedTypesBanner bannedTypes={state.bannedTypes} />

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
        質問{' '}
        {state.quizMode === 'competitive'
          ? state.traitProbes.length + state.statCompares.length
          : state.probes.length + state.dexCompares.length}{' '}
        回 · 外れ解答 {misses} 回
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
