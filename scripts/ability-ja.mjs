/**
 * Resolve English Showdown ability names / ids to Japanese display names.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const abilityNames = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/ability-names.json'), 'utf8'),
)

export function abilityNameJa(id, englishName) {
  if (id && abilityNames.byId[id]) return abilityNames.byId[id]
  if (id) {
    const compact = String(id).replace(/_/g, '')
    for (const [key, ja] of Object.entries(abilityNames.byId)) {
      if (key.replace(/_/g, '') === compact) return ja
    }
  }
  if (englishName) {
    const en = String(englishName)
    if (abilityNames.byEn[en]) return abilityNames.byEn[en]
    const normalized = en.replace(/’/g, "'")
    if (abilityNames.byEn[normalized]) return abilityNames.byEn[normalized]
  }
  return englishName || id || '不明'
}
