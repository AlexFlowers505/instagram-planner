import type { Post } from "../types/model"

/**
 * Метки — свободные слова, и именно поэтому за ними нужен присмотр.
 *
 * Набранная руками метка легко расходится с уже существующей: «люди» и
 * «Люди» — это два разных значения в массиве и два разных чипса в фильтре,
 * хотя человек имел в виду одно. Поэтому новая метка **сверяется с уже
 * заведёнными без учёта регистра и пробелов**, и при совпадении берётся
 * написание, которое уже есть на доске.
 *
 * Хранятся метки как данные пользователя: его слова, его регистр. Приводить
 * их все к нижнему регистру значило бы испортить имена собственные.
 */

/** Ключ сравнения. Только для сверки — на экран и в базу идёт исходное написание. */
export const tagKey = (tag: string) => tag.trim().toLowerCase()

/** Все метки доски по убыванию частоты: сначала то, чем пользуются. */
export function knownTags(posts: Post[]): string[] {
  const seen = new Map<string, { label: string; count: number }>()
  for (const post of posts) {
    for (const raw of post.tags) {
      const key = tagKey(raw)
      if (!key) continue
      const was = seen.get(key)
      if (was) was.count++
      else seen.set(key, { label: raw.trim(), count: 1 })
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).map(t => t.label)
}

/**
 * Добавить метку к набору. Возвращает прежний набор, если такая уже есть, —
 * в том числе когда она набрана в другом регистре.
 */
export function withTag(tags: string[], raw: string, known: string[]): string[] {
  const key = tagKey(raw)
  if (!key) return tags
  if (tags.some(t => tagKey(t) === key)) return tags
  // Написание берётся с доски: так «Люди» не раздвоится на «люди».
  const settled = known.find(t => tagKey(t) === key) ?? raw.trim()
  return [...tags, settled]
}

export const withoutTag = (tags: string[], raw: string): string[] =>
  tags.filter(t => tagKey(t) !== tagKey(raw))
