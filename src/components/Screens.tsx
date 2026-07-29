import { useEffect, useMemo, useState } from 'react'
import { TYPES, EFFECTIVENESS_LABEL_JA } from '../data/types'
import type {
  DexCompareRecord,
  EffectivenessLabel,
  EvoProbeRecord,
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
  findPokemonById,
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
import { calcEffectiveness } from '../lib/effectiveness'
import type { OnlineClientView } from '../lib/onlineRoom'
import { onlineViewToGameState } from '../lib/onlineView'
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

function typeMatchupRows(pokemon: Pokemon) {
  return TYPES.map((t) => ({
    type: t,
    ...calcEffectiveness(t, pokemon),
  }))
}

/** 等倍以外の相性を弱点／耐性で簡潔表示 */
function TypeMatchupGrid({ pokemon }: { pokemon: Pokemon }) {
  const { weak, resist } = useMemo(() => {
    const rows = typeMatchupRows(pokemon).filter((row) => row.label !== 'neutral')
    return {
      weak: rows.filter(
        (row) => row.label === 'super' || row.label === 'double_super',
      ),
      resist: rows.filter(
        (row) =>
          row.label === 'half' ||
          row.label === 'quarter' ||
          row.label === 'immune',
      ),
    }
  }, [pokemon])

  return (
    <div className="matchup-summary" aria-label={`${pokemon.name}のタイプ相性`}>
      <div className="matchup-summary-row">
        <span className="matchup-summary-tag weak">弱点</span>
        <div className="type-row matchup-chips">
          {weak.length === 0 ? (
            <span className="muted-inline">なし</span>
          ) : (
            weak.map((w) => (
              <span
                key={w.type}
                className={`matchup-chip result-${w.label}`}
                style={{ background: TYPE_COLORS[w.type] }}
                title={`${w.type}：${EFFECTIVENESS_LABEL_JA[w.label]}`}
              >
                {w.type}
                <small aria-hidden>{RESULT_MARK[w.label]}</small>
              </span>
            ))
          )}
        </div>
      </div>
      <div className="matchup-summary-row">
        <span className="matchup-summary-tag resist">耐性</span>
        <div className="type-row matchup-chips">
          {resist.length === 0 ? (
            <span className="muted-inline">なし</span>
          ) : (
            resist.map((w) => (
              <span
                key={w.type}
                className={`matchup-chip result-${w.label}`}
                style={{ background: TYPE_COLORS[w.type] }}
                title={`${w.type}：${EFFECTIVENESS_LABEL_JA[w.label]}`}
              >
                {w.type}
                <small aria-hidden>{RESULT_MARK[w.label]}</small>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** 候補タイル用：弱点だけ一行で表示 */
function TileWeaknesses({ pokemon }: { pokemon: Pokemon }) {
  const weak = useMemo(
    () =>
      typeMatchupRows(pokemon).filter(
        (row) => row.label === 'super' || row.label === 'double_super',
      ),
    [pokemon],
  )
  return (
    <span className="tile-weak" aria-label="弱点">
      <span className="tile-weak-label">弱点</span>
      {weak.length === 0 ? (
        <span className="tile-weak-none">なし</span>
      ) : (
        weak.map((w) => (
          <span
            key={w.type}
            className={`tile-weak-chip result-${w.label}`}
            style={{ background: TYPE_COLORS[w.type] }}
            title={`${w.type}：${EFFECTIVENESS_LABEL_JA[w.label]}`}
          >
            {w.type}
            <small aria-hidden>{RESULT_MARK[w.label]}</small>
          </span>
        ))
      )}
    </span>
  )
}

function TypeMatchupSheet({
  pokemon,
  onClose,
  primaryAction,
}: {
  pokemon: Pokemon
  onClose: () => void
  primaryAction?: { label: string; onClick: () => void }
}) {
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="sheet matchup-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${pokemon.name}のタイプ相性`}
        onClick={(e) => e.stopPropagation()}
      >
        <PokemonSprite pokemon={pokemon} name={pokemon.name} size={88} />
        <p className="sheet-title">{pokemon.name}</p>
        <span className="type-row center">
          {pokemon.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        <p className="sheet-sub matchup-sheet-lead">
          弱点・耐性
          {pokemon.ability.affectsTypes
            ? ` · 特性「${pokemon.ability.name}」反映`
            : ''}
        </p>
        <TypeMatchupGrid pokemon={pokemon} />
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            閉じる
          </button>
          {primaryAction && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                primaryAction.onClick()
                onClose()
              }}
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
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
  | { kind: 'evo'; yes: boolean }
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
  if (flash.kind === 'evo') {
    return (
      <div
        className={`flash-note visual trait ${flash.yes ? 'is-yes' : 'is-no'}`}
        role="status"
      >
        <span className="flash-yn" aria-hidden>
          {flash.yes ? '○' : '×'}
        </span>
        <span className="flash-trait-text">最終進化？</span>
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
  evoProbes = [],
  traitProbes = [],
  statCompares = [],
  quizMode,
  currentPlayer,
  names,
  expandAll = false,
}: {
  probes: ProbeRecord[]
  dexCompares: DexCompareRecord[]
  evoProbes?: EvoProbeRecord[]
  traitProbes?: TraitProbeRecord[]
  statCompares?: StatCompareRecord[]
  quizMode: QuizMode
  currentPlayer: PlayerId
  names: { p1: string; p2: string }
  /** Keep both lanes open (online wait / spectate). */
  expandAll?: boolean
}) {
  const competitive = quizMode === 'competitive'
  const [openOther, setOpenOther] = useState(expandAll)

  const lanes = useMemo(() => {
    const all = [
      {
        target: 'p2' as const,
        asker: 'p1' as const,
        probes: probes.filter((p) => p.by === 'p1'),
        dex: dexCompares.filter((c) => c.by === 'p1'),
        evo: evoProbes.filter((p) => p.by === 'p1'),
        traits: traitProbes.filter((p) => p.by === 'p1'),
        stats: statCompares.filter((c) => c.by === 'p1'),
      },
      {
        target: 'p1' as const,
        asker: 'p2' as const,
        probes: probes.filter((p) => p.by === 'p2'),
        dex: dexCompares.filter((c) => c.by === 'p2'),
        evo: evoProbes.filter((p) => p.by === 'p2'),
        traits: traitProbes.filter((p) => p.by === 'p2'),
        stats: statCompares.filter((c) => c.by === 'p2'),
      },
    ]
    return [...all].sort((a, b) => {
      const af = a.asker === currentPlayer ? 0 : 1
      const bf = b.asker === currentPlayer ? 0 : 1
      return af - bf
    })
  }, [probes, dexCompares, evoProbes, traitProbes, statCompares, currentPlayer])

  useEffect(() => {
    if (expandAll) setOpenOther(true)
    else setOpenOther(false)
  }, [currentPlayer, expandAll])

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
          const collapsed = !expandAll && !focusing && !openOther
          const itemCount = competitive
            ? lane.traits.length + lane.stats.length
            : lane.probes.length + lane.dex.length + lane.evo.length
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
                {focusing || expandAll ? (
                  <span className="lane-now">
                    {focusing ? 'いま動いてる' : '公開メモ'}
                  </span>
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
                        : 'まだ聞いていない。タイプ・図鑑・進化で絞ってね。'
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
                      : (
                        <>
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
                          {lane.evo.map((probe, i) => (
                            <li
                              key={`e-${i}`}
                              className={`clue-chip clue-chip-yn ${probe.isFinal ? 'is-yes' : 'is-no'}`}
                            >
                              <span className="clue-yn" aria-hidden>
                                {probe.isFinal ? '○' : '×'}
                              </span>
                              <span className="clue-dex-block">最終進化？</span>
                            </li>
                          ))}
                        </>
                      )}
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
  quizMode = 'type',
  onChange,
}: {
  pool: DexPool
  quizMode?: QuizMode
  onChange: (pool: DexPool) => void
}) {
  const counts = poolCounts(quizMode)
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
  onCreateOnline: (pool: DexPool, name: string, quizMode: QuizMode) => void
  onJoinOnline: (roomCode: string, name: string, quizMode: QuizMode) => void
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
            : quizMode === 'type_dual'
              ? '複合タイプだけを、相性・図鑑・進化で絞って当てる。'
              : '単タイプ込みで、相性・図鑑・進化から相手を当てる。'}
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
              {(['type', 'type_dual', 'competitive'] as QuizMode[]).map((qm) => (
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

            {quizMode !== 'competitive' ? (
              <PoolPicker pool={pool} quizMode={quizMode} onChange={setPool} />
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

            <div className="quiz-mode-switch" role="group" aria-label="オンライン推理モード">
              {(['type', 'type_dual'] as QuizMode[]).map((qm) => (
                <button
                  key={qm}
                  type="button"
                  className={quizMode === qm ? 'is-on' : ''}
                  onClick={() => setQuizMode(qm)}
                >
                  <strong>{QUIZ_MODE_LABEL[qm]}</strong>
                  <small>{QUIZ_MODE_BLURB[qm]}</small>
                </button>
              ))}
            </div>

            <PoolPicker pool={pool} quizMode={quizMode} onChange={setPool} />
            <p className="online-note">
              ネット対戦はタイプ相性モードのみ。単タイプ込み / 複合のみを選べます。端末同士を WebRTC
              でつなぎます（部屋主はタブを開いたまま）。
            </p>

            <button
              type="button"
              className="btn primary big"
              onClick={() => onCreateOnline(pool, onlineName, quizMode)}
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
                onClick={() => onJoinOnline(joinCode.trim(), onlineName, quizMode)}
              >
                参加
              </button>
            </div>
            <p className="online-note">
              別端末の相手に部屋コードを伝えてね。先に部屋をつくった人が先攻。通話は
              Discord など別アプリでOK。
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
                : quizMode === 'type_dual'
                  ? '基本はチャンピオンズ／全国の複合タイプのみ。公開タイプバンや質問上限は任意'
                  : '基本はチャンピオンズ／全国の単・複合タイプ。公開タイプバンや質問上限は任意'}
            </p>
          </div>
        </li>
        <li>
          <span className="step-num">2</span>
          <div>
            <strong>
              {quizMode === 'competitive'
                ? 'できること・速さで絞る'
                : 'タイプ・図鑑・進化で絞る'}
            </strong>
            <p>
              {quizMode === 'competitive'
                ? '「設置ある？」「この子より速い？」の答えがメモに残る'
                : '相性・図鑑の大小・最終進化の答えがメモに残る'}
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

function LiveCandidateMeters({
  names,
  counts,
  rosterSize,
  you,
  activePlayer,
}: {
  names: { p1: string; p2: string }
  counts: { p1: number; p2: number }
  rosterSize: number
  you: PlayerId
  activePlayer: PlayerId
}) {
  const max = Math.max(rosterSize, 1)
  return (
    <div className="live-meters" aria-label="候補の残り">
      {(['p1', 'p2'] as PlayerId[]).map((id) => {
        const pct = Math.round((counts[id] / max) * 100)
        return (
          <div
            key={id}
            className={`live-meter tone-${id} ${id === you ? 'is-you' : ''} ${id === activePlayer ? 'is-active' : ''}`}
          >
            <div className="live-meter-head">
              <span>
                {playerLabel(id, names)}
                {id === you ? '（自分）' : ''}
              </span>
              <strong>{counts[id]}</strong>
            </div>
            <div className="live-meter-bar" aria-hidden>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="live-meter-cap">候補の残り</p>
          </div>
        )
      })}
    </div>
  )
}

function SecretPickCard({
  pokemon,
  probesOnYou,
}: {
  pokemon: Pokemon
  probesOnYou: ProbeRecord[]
}) {
  const weaknesses = useMemo(() => {
    return TYPES.map((t) => ({
      type: t,
      ...calcEffectiveness(t, pokemon),
    })).filter(
      (row) =>
        row.label === 'super' ||
        row.label === 'double_super' ||
        row.label === 'immune' ||
        row.label === 'quarter' ||
        row.label === 'half',
    )
  }, [pokemon])

  const weak = weaknesses.filter(
    (w) => w.label === 'super' || w.label === 'double_super',
  )
  const resist = weaknesses.filter(
    (w) =>
      w.label === 'half' ||
      w.label === 'quarter' ||
      w.label === 'immune',
  )

  return (
    <section className="secret-pick" aria-label="自分の秘密ポケモン">
      <header className="secret-pick-head">
        <span className="live-pill">秘密（自分だけ）</span>
        <h3>選んだポケモン</h3>
      </header>
      <div className="secret-pick-body">
        <PokemonSprite pokemon={pokemon} name={pokemon.name} size={88} />
        <div className="secret-pick-text">
          <strong>{pokemon.name}</strong>
          <span className="type-row">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
          <span className="secret-ability">特性 {pokemon.ability.name}</span>
        </div>
      </div>

      <div className="secret-chart">
        <p className="secret-chart-label">弱点・耐性（自分用メモ）</p>
        <div className="secret-chart-row">
          <span className="secret-chart-tag weak">弱点</span>
          <div className="type-row">
            {weak.length === 0 ? (
              <span className="muted-inline">なし</span>
            ) : (
              weak.map((w) => (
                <span
                  key={w.type}
                  className={`secret-eff result-${w.label}`}
                  style={{ background: TYPE_COLORS[w.type] }}
                >
                  {w.type}
                  <small>{RESULT_MARK[w.label]}</small>
                </span>
              ))
            )}
          </div>
        </div>
        <div className="secret-chart-row">
          <span className="secret-chart-tag resist">耐性</span>
          <div className="type-row">
            {resist.slice(0, 8).map((w) => (
              <span
                key={w.type}
                className={`secret-eff result-${w.label}`}
                style={{ background: TYPE_COLORS[w.type] }}
              >
                {w.type}
                <small>{RESULT_MARK[w.label]}</small>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="secret-probes">
        <p className="secret-chart-label">相手が自分に聞いた相性</p>
        {probesOnYou.length === 0 ? (
          <p className="lane-empty">まだ聞かれていない</p>
        ) : (
          <ul className="clue-chips">
            {probesOnYou.map((probe, i) => (
              <li key={`${probe.moveType}-${i}`} className="clue-chip">
                <span
                  className="clue-type-block"
                  style={{ background: TYPE_COLORS[probe.moveType] }}
                >
                  {probe.moveType}
                </span>
                <span className="clue-chip-arrow" aria-hidden>
                  →
                </span>
                <span className={`clue-result-block result-${probe.result}`}>
                  <span className="result-mark" aria-hidden>
                    {RESULT_MARK[probe.result]}
                  </span>
                  {EFFECTIVENESS_LABEL_JA[probe.result]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** Online: wait for opponent while still seeing live board + your secret. */
export function OnlineWatchScreen({
  view,
  roomCode,
  onLeave,
}: {
  view: OnlineClientView
  roomCode?: string
  onLeave?: () => void
}) {
  const you = view.you!
  const active = view.currentPlayer
  const myPokemon = view.myPick
    ? getPokemon(view.myPick, view.pool, view.quizMode)
    : null
  const probesOnYou = view.probes.filter((p) => p.by !== you)
  const [pulse, setPulse] = useState(0)
  const [candTab, setCandTab] = useState<'rival' | 'mine'>('rival')
  const gameState = useMemo(() => onlineViewToGameState(view), [view])
  const rivalCandidates = useMemo(
    () => filterCandidates(gameState, active),
    [gameState, active],
  )
  const myCandidates = useMemo(
    () => filterCandidates(gameState, you),
    [gameState, you],
  )
  const [candQuery, setCandQuery] = useState('')
  const [inspectCand, setInspectCand] = useState<Pokemon | null>(null)
  const activeList = candTab === 'rival' ? rivalCandidates : myCandidates
  const visibleCand = useMemo(() => {
    const q = candQuery.trim()
    return activeList.filter((p) => !q || p.name.includes(q))
  }, [activeList, candQuery])

  useEffect(() => {
    setPulse((n) => n + 1)
  }, [view.lastMessage, view.probes.length, view.dexCompares.length, view.evoProbes.length, active])

  useEffect(() => {
    setCandQuery('')
    setInspectCand(null)
  }, [candTab])

  return (
    <section className={`screen watch-screen tone-${you}`}>
      <header className="live-status">
        <div className="live-status-row">
          <span className="live-dot" aria-hidden />
          <span className="live-status-label">LIVE</span>
          {roomCode && <span className="live-room">{roomCode}</span>}
        </div>
        <h2 className="live-turn">
          {playerLabel(active, view.names)} が推理中…
        </h2>
        <p key={pulse} className="live-ticker">
          {view.lastMessage ?? '相手の操作を待っています'}
        </p>
        <p className="live-hint">
          <span className="thinking-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          候補はタブで切り替え。デフォルトは相手側
        </p>
      </header>

      <LiveCandidateMeters
        names={view.names}
        counts={view.candidateCounts}
        rosterSize={view.rosterSize}
        you={you}
        activePlayer={active}
      />

      <section className="rival-candidates" aria-label="候補リスト">
        <div className="cand-tabs" role="tablist" aria-label="候補の切り替え">
          <button
            type="button"
            role="tab"
            aria-selected={candTab === 'rival'}
            className={candTab === 'rival' ? 'is-on' : ''}
            onClick={() => setCandTab('rival')}
          >
            相手の候補
            <strong>{rivalCandidates.length}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={candTab === 'mine'}
            className={candTab === 'mine' ? 'is-on' : ''}
            onClick={() => setCandTab('mine')}
          >
            自分の候補
            <strong>{myCandidates.length}</strong>
          </button>
        </div>
        <header className="rival-cand-head">
          <h3>
            {candTab === 'rival'
              ? `${playerLabel(active, view.names)} が絞っている候補`
              : '自分が当てる相手の候補'}
          </h3>
          <input
            type="search"
            placeholder="名前で探す"
            value={candQuery}
            onChange={(e) => setCandQuery(e.target.value)}
            aria-label="候補を名前で探す"
          />
        </header>
        {visibleCand.length === 0 ? (
          <p className="empty-panel">条件に合う候補がない</p>
        ) : (
          <div className="poke-tray compact rival-tray">
            {visibleCand.map((p) => (
              <button
                key={p.id}
                type="button"
                className="poke-tile has-weak"
                onClick={() => setInspectCand(p)}
                aria-label={`${p.name}のタイプ相性を見る`}
              >
                <PokemonSprite pokemon={p} name={p.name} size={56} />
                <span className="poke-name">{p.name}</span>
                <span className="type-row">
                  {p.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
                <TileWeaknesses pokemon={p} />
              </button>
            ))}
          </div>
        )}
      </section>

      {inspectCand && (
        <TypeMatchupSheet
          pokemon={inspectCand}
          onClose={() => setInspectCand(null)}
        />
      )}

      {myPokemon && (
        <SecretPickCard pokemon={myPokemon} probesOnYou={probesOnYou} />
      )}

      <ClueBoard
        probes={view.probes}
        dexCompares={view.dexCompares}
        evoProbes={view.evoProbes}
        quizMode="type"
        currentPlayer={active}
        names={view.names}
        expandAll
      />

      {onLeave && (
        <div className="watch-footer">
          <button type="button" className="btn ghost" onClick={onLeave}>
            部屋をやめる
          </button>
        </div>
      )}
    </section>
  )
}

/** Online picking wait: show your locked pick while opponent chooses. */
export function OnlinePickWaitScreen({
  view,
  roomCode,
  onLeave,
}: {
  view: OnlineClientView
  roomCode?: string
  onLeave?: () => void
}) {
  const you = view.you!
  const myPokemon = view.myPick
    ? getPokemon(view.myPick, view.pool, view.quizMode)
    : null

  return (
    <section className={`screen watch-screen tone-${you}`}>
      <header className="live-status">
        <div className="live-status-row">
          <span className="live-dot" aria-hidden />
          <span className="live-status-label">LIVE</span>
          {roomCode && <span className="live-room">{roomCode}</span>}
        </div>
        <h2 className="live-turn">相手の選出待ち</h2>
        <p className="live-ticker">
          {view.lastMessage ?? '相手がポケモンを選んでいます'}
        </p>
      </header>

      {myPokemon && (
        <SecretPickCard pokemon={myPokemon} probesOnYou={[]} />
      )}

      <div className="pick-wait-rival">
        <span className="mystery-ball big" aria-hidden />
        <p>
          {playerLabel(opponentOf(you), view.names)} が選出中
          <span className="thinking-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </p>
      </div>

      {onLeave && (
        <div className="watch-footer">
          <button type="button" className="btn ghost" onClick={onLeave}>
            部屋をやめる
          </button>
        </div>
      )}
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
        <div className="dock has-matchup">
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
          <div className="dock-matchup">
            <p className="dock-matchup-label">弱点・耐性</p>
            <TypeMatchupGrid pokemon={selected} />
          </div>
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
  onEvoProbe,
  onTraitProbe,
  onStatCompare,
  onGuess,
}: {
  state: GameState
  onProbe: (t: PokemonType) => void
  onDexCompare: (pivotId: string) => void
  onEvoProbe: () => void
  onTraitProbe: (traitId: CompetitiveTraitId) => void
  onStatCompare: (pivotId: string, stat: CompetitiveStatId) => void
  onGuess: (id: string) => void
}) {
  const competitive = state.quizMode === 'competitive'
  const catchup = state.phase === 'catchup'
  const askLeft = questionsRemaining(state, state.currentPlayer)
  const canAsk = canAskQuestion(state, state.currentPlayer)
  type BattleTab = 'probe' | 'dex' | 'evo' | 'trait' | 'stat' | 'guess'
  const defaultTab: BattleTab = catchup || !canAsk
    ? 'guess'
    : competitive
      ? 'trait'
      : 'probe'
  const [mode, setMode] = useState<BattleTab>(defaultTab)
  const [query, setQuery] = useState('')
  const [candTab, setCandTab] = useState<'mine' | 'rival'>('mine')
  const [inspectCand, setInspectCand] = useState<Pokemon | null>(null)
  const [pendingGuess, setPendingGuess] = useState<Pokemon | null>(null)
  const [pendingDex, setPendingDex] = useState<Pokemon | null>(null)
  const [pendingStat, setPendingStat] = useState<Pokemon | null>(null)
  const [statKind, setStatKind] = useState<CompetitiveStatId>('speed')
  const [flash, setFlash] = useState<FlashState>(null)

  const candidates = filterCandidates(state, state.currentPlayer)
  const rivalCandidates = filterCandidates(
    state,
    opponentOf(state.currentPlayer),
  )
  const roster = pokemonIn(state.pool, state.quizMode)
  const targetOwner = opponentOf(state.currentPlayer)
  const remainPct = Math.round((candidates.length / roster.length) * 100)
  const rivalPct = Math.round((rivalCandidates.length / roster.length) * 100)

  const activeCandList = candTab === 'mine' ? candidates : rivalCandidates
  const visibleCandidates = useMemo(() => {
    const q = query.trim()
    return activeCandList.filter((p) => !q || p.name.includes(q))
  }, [activeCandList, query])

  const canActOnTile =
    candTab === 'mine' &&
    (mode === 'guess' ||
      mode === 'dex' ||
      mode === 'stat' ||
      catchup ||
      !canAsk)

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

  const askedEvo = state.evoProbes.some((p) => p.by === state.currentPlayer)

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
    const lastEvo = state.evoProbes[state.evoProbes.length - 1]
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
    } else if (lastEvo && state.lastMessage.includes('最終進化')) {
      setFlash({ kind: 'evo', yes: lastEvo.isFinal })
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
    state.evoProbes,
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
    setCandTab('mine')
    setInspectCand(null)
    setPendingGuess(null)
    setPendingDex(null)
    setPendingStat(null)
  }, [
    state.currentPlayer,
    catchup,
    competitive,
    state.probes.length,
    state.dexCompares.length,
    state.evoProbes.length,
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
          : mode === 'evo'
            ? '最終進化かどうかを聞く'
            : mode === 'trait'
              ? '相手に聞けること'
              : mode === 'stat'
                ? '基準のポケモンを選ぶ'
                : 'どれだと思う？'

  const showTraitPad = mode === 'trait' && !catchup && canAsk
  const showTypePad = mode === 'probe' && !catchup && canAsk && !competitive
  const showEvoPad = mode === 'evo' && !catchup && canAsk && !competitive
  const showList =
    !showTraitPad &&
    !showTypePad &&
    !showEvoPad &&
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
        <div className="remain-box live-remain">
          <div className="remain-pair">
            <p className="remain">
              自分 <strong>{candidates.length}</strong>
              <span> / {roster.length}</span>
            </p>
            <div className="remain-bar" aria-hidden>
              <span style={{ width: `${remainPct}%` }} />
            </div>
          </div>
          <div className="remain-pair is-rival">
            <p className="remain">
              相手 <strong>{rivalCandidates.length}</strong>
              <span> / {roster.length}</span>
            </p>
            <div className="remain-bar rival" aria-hidden>
              <span style={{ width: `${rivalPct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <BannedTypesBanner bannedTypes={state.bannedTypes} />

      <ActionFlash flash={flash} />

      <div className="battle-body">
        <div className="battle-main">
      {!catchup && (
        <div
          className={`action-switch ${competitive ? 'three' : 'four'}`}
          role="tablist"
          aria-label="行動"
        >
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
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'evo'}
                className={mode === 'evo' ? 'is-on' : ''}
                disabled={!canAsk}
                onClick={() => canAsk && setMode('evo')}
              >
                進化を聞く
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

      {showEvoPad && (
        <div className="evo-pad">
          <p className="ask-guide">
            「これ以上進化しない？」を1回だけ聞けます。進化前と最終進化を大きく分けられます。
          </p>
          <button
            type="button"
            className={`btn primary evo-ask ${askedEvo ? 'is-used' : ''}`}
            disabled={askedEvo}
            onClick={() => onEvoProbe()}
          >
            {askedEvo ? '最終進化？ … 済' : '最終進化？'}
          </button>
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

      <div className="guess-pane candidate-browser">
        <div className="cand-tabs" role="tablist" aria-label="候補の切り替え">
          <button
            type="button"
            role="tab"
            aria-selected={candTab === 'mine'}
            className={candTab === 'mine' ? 'is-on' : ''}
            onClick={() => {
              setCandTab('mine')
              setQuery('')
            }}
          >
            自分の候補
            <strong>{candidates.length}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={candTab === 'rival'}
            className={candTab === 'rival' ? 'is-on' : ''}
            onClick={() => {
              setCandTab('rival')
              setQuery('')
            }}
          >
            相手の候補
            <strong>{rivalCandidates.length}</strong>
          </button>
        </div>

        {showList && mode === 'stat' && !catchup && canAsk && canActOnTile && (
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
        {canActOnTile && mode === 'dex' && !catchup && canAsk && (
          <p className="dex-hint">
            基準を選ぶと「図鑑番号はこれより大きい？」と聞ける
          </p>
        )}
        {canActOnTile && mode === 'stat' && !catchup && canAsk && (
          <p className="dex-hint">{statAsk(statKind)}</p>
        )}
        {!canActOnTile && (
          <p className="dex-hint">
            {candTab === 'rival'
              ? '相手が絞っている候補。タップで弱点・耐性を確認'
              : 'タップで弱点・耐性を確認（解答は「名前を当てる」から）'}
          </p>
        )}
        {visibleCandidates.length === 0 ? (
          <p className="empty-panel">
            条件に合う候補がない。メモを見直してみて。
          </p>
        ) : (
          <div className="poke-tray compact rival-tray">
            {visibleCandidates.map((p) => {
              const usedDex =
                canActOnTile && mode === 'dex' && usedPivots.has(p.id)
              const usedStat =
                canActOnTile &&
                mode === 'stat' &&
                usedStatKeys.has(`${statKind}:${p.id}`)
              const used = usedDex || usedStat
              const meta = competitive ? getCompetitiveMeta(p.id) : undefined
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`poke-tile has-weak ${used ? 'is-used' : ''}`}
                  disabled={used}
                  onClick={() => {
                    if (!canActOnTile) {
                      setInspectCand(p)
                      return
                    }
                    if (mode === 'dex' && !catchup) setPendingDex(p)
                    else if (mode === 'stat' && !catchup) setPendingStat(p)
                    else setPendingGuess(p)
                  }}
                >
                  <PokemonSprite pokemon={p} name={p.name} size={60} />
                  <span className="poke-name">{p.name}</span>
                  {canActOnTile && mode === 'stat' && meta ? (
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
                  <TileWeaknesses pokemon={p} />
                  {used && <small className="tile-used">比較済</small>}
                </button>
              )
            })}
          </div>
        )}
      </div>
        </div>

      <ClueBoard
        probes={state.probes}
        dexCompares={state.dexCompares}
        evoProbes={state.evoProbes}
        traitProbes={state.traitProbes}
        statCompares={state.statCompares}
        quizMode={state.quizMode}
        currentPlayer={state.currentPlayer}
        names={state.names}
      />
      </div>

      {inspectCand && (
        <TypeMatchupSheet
          pokemon={inspectCand}
          onClose={() => setInspectCand(null)}
        />
      )}

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
            <p className="sheet-sub matchup-sheet-lead">弱点・耐性</p>
            <TypeMatchupGrid pokemon={pendingDex} />
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
            <p className="sheet-sub matchup-sheet-lead">弱点・耐性</p>
            <TypeMatchupGrid pokemon={pendingStat} />
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
            <p className="sheet-sub matchup-sheet-lead">弱点・耐性</p>
            <TypeMatchupGrid pokemon={pendingGuess} />
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
  const p1 =
    findPokemonById(state.picks.p1) ??
    getPokemon(state.picks.p1 ?? '', state.pool, state.quizMode)
  const p2 =
    findPokemonById(state.picks.p2) ??
    getPokemon(state.picks.p2 ?? '', state.pool, state.quizMode)
  const misses = state.guesses.filter((g) => !g.correct).length

  const loser: PlayerId | null = state.draw
    ? null
    : state.winner === 'p1'
      ? 'p2'
      : state.winner === 'p2'
        ? 'p1'
        : null
  const lastMissGuess = loser
    ? [...state.guesses].reverse().find((g) => !g.correct && g.by === loser)
    : null
  const lastMissPokemon = lastMissGuess
    ? (findPokemonById(lastMissGuess.pokemonId) ??
      getPokemon(lastMissGuess.pokemonId, state.pool, state.quizMode))
    : null

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

      <h3 className="result-reveal-title">選出ポケモン公開</h3>
      <div className="reveal-row">
        <RevealBlock
          player="p1"
          names={state.names}
          pokemon={p1}
          pickId={state.picks.p1}
          winner={state.draw || state.winner === 'p1'}
          draw={state.draw}
        />
        <RevealBlock
          player="p2"
          names={state.names}
          pokemon={p2}
          pickId={state.picks.p2}
          winner={state.draw || state.winner === 'p2'}
          draw={state.draw}
        />
      </div>

      {lastMissGuess && (
        <section className="result-last-miss" aria-label="最後の外れ解答">
          <h3 className="result-reveal-title">
            {playerLabel(lastMissGuess.by, state.names)} の最後の外れ
          </h3>
          <div className="last-miss-card">
            {lastMissPokemon ? (
              <PokemonSprite
                pokemon={lastMissPokemon}
                name={lastMissPokemon.name}
                size={88}
              />
            ) : (
              <PokemonSprite
                id={lastMissGuess.pokemonId}
                name={lastMissGuess.pokemonId}
                size={88}
              />
            )}
            <div className="last-miss-text">
              <p className="poke-name">
                {lastMissPokemon?.name ?? lastMissGuess.pokemonId}
              </p>
              {lastMissPokemon && (
                <span className="type-row center">
                  {lastMissPokemon.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
              )}
              <p className="last-miss-note">これに解答して外した</p>
            </div>
          </div>
        </section>
      )}

      <p className="result-meta">
        質問{' '}
        {state.quizMode === 'competitive'
          ? state.traitProbes.length + state.statCompares.length
          : state.probes.length +
            state.dexCompares.length +
            state.evoProbes.length}{' '}
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
  pickId,
  winner,
  draw = false,
}: {
  player: PlayerId
  names: { p1: string; p2: string }
  pokemon: Pokemon | undefined
  pickId: string | null
  winner: boolean
  draw?: boolean
}) {
  const name = pokemon?.name ?? (pickId ? `??? (${pickId})` : '未選出')
  return (
    <div className={`reveal-block ${winner ? 'is-winner' : ''} tone-${player}`}>
      <p className="reveal-label">
        <PlayerTag player={player} names={names} />
        {draw || winner ? <span className="win-flag">正解</span> : null}
      </p>
      {pokemon ? (
        <PokemonSprite pokemon={pokemon} name={name} size={110} />
      ) : (
        <PokemonSprite id={pickId ?? undefined} name={name} size={110} />
      )}
      <p className="poke-name">{name}</p>
      {pokemon ? (
        <>
          <span className="type-row center">
            {pokemon.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
          <p className="dock-ability">
            特性 {pokemon.ability.name}
            {pokemon.ability.affectsTypes ? ' · 相性に影響' : ''}
          </p>
        </>
      ) : (
        <p className="dock-ability">タイプ情報なし</p>
      )}
    </div>
  )
}
