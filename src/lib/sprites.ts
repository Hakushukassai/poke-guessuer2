import type { Pokemon } from '../data/types'

/** Explicit Showdown sprite slugs for awkward forme ids. */
const SPRITE_OVERRIDES: Record<string, string> = {
  basculegionf: 'basculegion-f',
  aegislashblade: 'aegislash-blade',
  taurospaldeablaze: 'tauros-paldeablaze',
  taurospaldeaaqua: 'tauros-paldeaaqua',
  gourgeistlarge: 'gourgeist-large',
  gourgeistsuper: 'gourgeist-super',
  gourgeistsmall: 'gourgeist-small',
  vivillonfancy: 'vivillon-fancy',
  vivillonpokeball: 'vivillon-pokeball',
  mimikyubusted: 'mimikyu-busted',
  charizardmegax: 'charizard-megax',
  charizardmegay: 'charizard-megay',
  morpekohangry: 'morpeko-hangry',
  sinistchamasterpiece: 'sinistcha-masterpiece',
  calyrexice: 'calyrex-ice',
  calyrexshadow: 'calyrex-shadow',
  enamorustherian: 'enamorus-therian',
  landoriustherian: 'landorus-therian',
  thundurustherian: 'thundurus-therian',
  tornadustherian: 'tornadus-therian',
  eternatuseternamax: 'eternatus-eternamax',
  kyuremblack: 'kyurem-black',
  kyuremwhite: 'kyurem-white',
  groudonprimal: 'groudon-primal',
  kyogreprimal: 'kyogre-primal',
  greninjaash: 'greninja-ash',
  greninjabond: 'greninja-bond',
  ursalunabloodmoon: 'ursaluna-bloodmoon',
  urshifu: 'urshifu',
  urshifurapidstrike: 'urshifu-rapidstrike',
  oricoriopompom: 'oricorio-pompom',
  oricoriopau: 'oricorio-pau',
  oricoriosensu: 'oricorio-sensu',
  wooperpaldea: 'wooper-paldea',
  squawkabillyblue: 'squawkabilly-blue',
  squawkabillyyellow: 'squawkabilly-yellow',
  squawkabillywhite: 'squawkabilly-white',
  cramorantgulping: 'cramorant-gulping',
  cramorantgorging: 'cramorant-gorging',
  necrozmaultra: 'necrozma-ultra',
  necrozmadawnwings: 'necrozma-dawnwings',
  necrozmaduskmane: 'necrozma-duskmane',
  ogerponwellspring: 'ogerpon-wellspring',
  ogerponcornerstone: 'ogerpon-cornerstone',
  ogerponhearthflame: 'ogerpon-hearthflame',
  mausholdfour: 'maushold-four',
  palafinhero: 'palafin-hero',
  meowsticf: 'meowstic-f',
  taurospaldeacombat: 'tauros-paldeacombat',
  polteageistantique: 'polteageist-antique',
  keldeoresolute: 'keldeo-resolute',
  genesectdouse: 'genesect-douse',
  genesectshock: 'genesect-shock',
  genesectburn: 'genesect-burn',
  genesectchill: 'genesect-chill',
  zaciancrowned: 'zacian-crowned',
  zamazentacrowned: 'zamazenta-crowned',
  shayminsky: 'shaymin-sky',
  zygarde10: 'zygarde-10',
  zygardecomplete: 'zygarde-complete',
  tatsugiridroopy: 'tatsugiri-droopy',
  tatsugiristretchy: 'tatsugiri-stretchy',
  miniormeteor: 'minior',
  magearnaoriginal: 'magearna-original',
  toxtricitylowkey: 'toxtricity-lowkey',
  darmanitanzen: 'darmanitan-zen',
  darmanitangalarzen: 'darmanitan-galarzen',
  hoopaunbound: 'hoopa-unbound',
  wormadamsandy: 'wormadam-sandy',
  wormadamtrash: 'wormadam-trash',
  meloettapirouette: 'meloetta-pirouette',
  poltchageistartisan: 'poltchageist-artisan',
  marowakalolatotem: 'marowakalola',
  togedemarutotem: 'togedemaru',
  zarudedada: 'zarude-dada',
  giratinaorigin: 'giratina-origin',
}

export function toSpriteSlug(speciesId: string): string {
  if (SPRITE_OVERRIDES[speciesId]) return SPRITE_OVERRIDES[speciesId]

  return speciesId
    .replace(/megax$/, '-megax')
    .replace(/megay$/, '-megay')
    .replace(/megaz$/, '-megaz')
    .replace(/mega$/, '-mega')
    .replace(/alola$/, '-alola')
    .replace(/galar$/, '-galar')
    .replace(/hisui$/, '-hisui')
    .replace(/(rotom)(wash|heat|frost|fan|mow)$/, '$1-$2')
    .replace(/therian$/, '-therian')
    .replace(/origin$/, '-origin')
    .replace(/primal$/, '-primal')
    .replace(/bloodmoon$/, '-bloodmoon')
    .replace(/hangry$/, '-hangry')
    .replace(/busted$/, '-busted')
}

export function spriteSlugFor(pokemon: Pokemon | string): string {
  if (typeof pokemon === 'string') return toSpriteSlug(pokemon)
  return pokemon.sprite || toSpriteSlug(pokemon.id)
}

function artworkUrl(num: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`
}

/** Ordered candidates: dex → gen5 → official artwork. */
export function spriteCandidates(pokemon: Pokemon | string): string[] {
  const slug = spriteSlugFor(pokemon)
  const urls = [
    `https://play.pokemonshowdown.com/sprites/dex/${slug}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`,
  ]
  if (typeof pokemon !== 'string' && pokemon.num && pokemon.num > 0) {
    urls.push(artworkUrl(pokemon.num))
  }
  return [...new Set(urls)]
}

/** @deprecated prefer spriteCandidates */
export function spriteUrl(speciesIdOrPokemon: string | Pokemon): string {
  return spriteCandidates(speciesIdOrPokemon)[0]
}

export function spriteUrlGen5(speciesIdOrPokemon: string | Pokemon): string {
  const slug = spriteSlugFor(speciesIdOrPokemon)
  return `https://play.pokemonshowdown.com/sprites/gen5/${slug}.png`
}
