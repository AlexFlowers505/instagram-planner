import type { Board, Series } from "../types/model"

/**
 * Чтение серий: корень, цвет, путь. Уровней ровно два, но код всё равно идёт
 * по родителям циклом — так он не развалится, если база когда-нибудь пропустит
 * третий, и так же работает «вне серий».
 */

/** Пост без серии стоит здесь. Это ответ, а не пропуск. */
export const NO_SERIES: Series = {
  id: "",
  parentId: null,
  name: "Вне серий",
  color: "#8C949E",
  kind: "rubric",
}

export type SeriesLookup = {
  get: (id: string | null) => Series
  /** Серия верхнего уровня: от неё берётся цвет. */
  rootOf: (id: string | null) => Series
  colorOf: (id: string | null) => string
  /** «Пекин → Цзиншань». Для поста вне серий — одно слово. */
  pathOf: (id: string | null) => string[]
  roots: Series[]
  childrenOf: (id: string) => Series[]
}

export function seriesLookup(board: Board): SeriesLookup {
  const byId = new Map(board.series.map(s => [s.id, s]))

  const get = (id: string | null) => (id && byId.get(id)) || NO_SERIES

  const rootOf = (id: string | null) => {
    let s = get(id)
    const seen = new Set<string>()
    while (s.parentId && !seen.has(s.parentId)) {
      seen.add(s.parentId)
      s = get(s.parentId)
    }
    return s
  }

  const pathOf = (id: string | null) => {
    const out: string[] = []
    let s: Series | null = get(id)
    const seen = new Set<string>()
    while (s && !seen.has(s.id)) {
      seen.add(s.id)
      out.unshift(s.name)
      s = s.parentId ? get(s.parentId) : null
    }
    return out
  }

  return {
    get,
    rootOf,
    colorOf: id => rootOf(id).color ?? NO_SERIES.color!,
    pathOf,
    roots: board.series.filter(s => !s.parentId),
    childrenOf: id => board.series.filter(s => s.parentId === id),
  }
}
