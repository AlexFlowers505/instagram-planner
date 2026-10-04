import type { Board, Post } from "../types/model"
import { daysBetween } from "./date"

/**
 * Порядок ленты и расхождения ориентира.
 *
 * Единой оси дат нет и быть не должно (ADR 0003): **прошлое упорядочено по
 * дням выхода, будущее — очередью**. Поэтому здесь два отсортированных списка,
 * а не один `sort` по дате.
 */

/** День, на котором пост стоит: настоящий, если вышел, иначе ориентир. */
export const shownDate = (p: Post): string | null =>
  p.status === "posted" ? p.publishedOn : p.status === "planned" ? p.targetOn : null

/** Вышедшее, от раннего к позднему. */
export const posted = (posts: Post[]): Post[] =>
  posts
    .filter(p => p.status === "posted")
    .sort((a, b) => (a.publishedOn ?? "").localeCompare(b.publishedOn ?? ""))

/**
 * Очередь запланированного. Сортировка по рангу числом — **ранг бывает нулём
 * и отрицательным**, поэтому сравнение идёт через `?? 0`, а не через проверку
 * на истинность.
 */
export const queue = (posts: Post[]): Post[] =>
  posts
    .filter(p => p.status === "planned")
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

/** Идеи не в ленте: у них нет места в очереди. Они лежат на полке. */
export const ideas = (posts: Post[]): Post[] => posts.filter(p => p.status === "idea")

/** Лента по порядку выхода: сначала вышедшее, потом очередь. */
export const feedOrder = (posts: Post[]): Post[] => [...posted(posts), ...queue(posts)]

export type Clash =
  | { kind: "past"; text: string }
  | { kind: "order"; text: string }

/**
 * Два способа, которыми ориентир спорит с очередью. Доска их **показывает и не
 * исправляет**: что именно имелось в виду, знает только владелец.
 *
 * `inQueue` — та же очередь, что рисуется, чтобы сравнение шло по тому, что
 * человек видит, а не по отдельно пересчитанному порядку.
 */
export function clashesOf(post: Post, inQueue: Post[], today: string): Clash[] {
  if (post.status !== "planned" || !post.targetOn) return []
  const out: Clash[] = []

  if (post.targetOn < today) {
    out.push({ kind: "past", text: "ориентир уже в прошлом, а пост не выложен" })
  }

  const i = inQueue.findIndex(p => p.id === post.id)
  if (i >= 0) {
    for (let j = i + 1; j < inQueue.length; j++) {
      const later = inQueue[j]
      if (later.targetOn && later.targetOn < post.targetOn) {
        out.push({
          kind: "order",
          text: `стоит в очереди раньше, чем «${later.heading}», но намечен позже`,
        })
        break
      }
    }
  }

  return out
}

export type Rhythm = {
  byFormat: Record<Post["format"], number>
  /** Самый длинный ряд одного формата подряд. */
  longestRun: { format: Post["format"]; length: number } | null
  /** Самая длинная пауза — **только по вышедшему**: у будущего настоящих дат нет. */
  longestGap: { days: number; from: string; to: string } | null
}

export function rhythm(posts: Post[]): Rhythm {
  const line = feedOrder(posts)

  // Считается по ленте, а не по всем постам: идей в ленте нет, и включать их в
  // набор форматов значит описывать не то, что видно на экране.
  const byFormat: Rhythm["byFormat"] = { reel: 0, single: 0, carousel: 0 }
  for (const p of line) byFormat[p.format]++

  let run = 0
  let current: Post["format"] | null = null
  let longestRun: Rhythm["longestRun"] = null
  for (const p of line) {
    if (p.format === current) run++
    else {
      current = p.format
      run = 1
    }
    if (!longestRun || run > longestRun.length) longestRun = { format: p.format, length: run }
  }

  const out = posted(posts)
  let longestGap: Rhythm["longestGap"] = null
  for (let i = 1; i < out.length; i++) {
    const from = out[i - 1].publishedOn!
    const to = out[i].publishedOn!
    const days = daysBetween(from, to)
    if (!longestGap || days > longestGap.days) longestGap = { days, from, to }
  }

  return { byFormat, longestRun, longestGap }
}

export const boardPosts = (board: Board): Post[] => board.posts.filter(p => !p.archived)
