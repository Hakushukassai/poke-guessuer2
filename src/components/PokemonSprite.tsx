import { useState } from 'react'
import type { Pokemon } from '../data/types'
import { spriteCandidates } from '../lib/sprites'

export function PokemonSprite({
  pokemon,
  id,
  name,
  size = 64,
  className = '',
}: {
  pokemon?: Pokemon
  id?: string
  name: string
  size?: number
  className?: string
}) {
  const target = pokemon ?? id ?? ''
  const candidates = spriteCandidates(target)
  const [index, setIndex] = useState(0)

  if (index >= candidates.length) {
    return (
      <span
        className={`poke-sprite placeholder ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        ?
      </span>
    )
  }

  return (
    <img
      className={`poke-sprite ${className}`}
      src={candidates[index]}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
    />
  )
}
