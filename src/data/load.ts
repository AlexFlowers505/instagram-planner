import type { Board, Highlight, Post, Series, Story } from "../types/model"
import {
  HIGHLIGHT_COLUMNS, POST_COLUMNS, SELECT, SERIES_COLUMNS, STORY_COLUMNS, TABLE,
  fromRow,
} from "./schema"
import { PAGE_SIZE, client, unwrap } from "./supabase"

/**
 * Собирает доску обратно из четырёх таблиц. Разделение на таблицы кончается
 * здесь: выше по коду есть только `Board`.
 */

type Row = Record<string, unknown>

/**
 * Запрос фильтрует по владельцу, хотя RLS и так не отдаст чужого.
 * **RLS — это защита, а не способ отбора**: политика отсекает лишнее, но
 * планировщик работает лучше, когда условие стоит в запросе, и намерение
 * видно в коде.
 */
async function fetchAll(table: string, select: string, userId: string, where: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await client()
      .from(table)
      .select(select)
      .eq("user_id", userId)
      .range(from, from + PAGE_SIZE - 1)
    const page = unwrap<Row[]>(where, res)
    out.push(...page)
    // Postgrest отдаёт не больше PAGE_SIZE: неполная страница значит, что это
    // последняя.
    if (page.length < PAGE_SIZE) break
  }
  return out
}

export async function loadBoard(userId: string): Promise<Board> {
  const [series, posts, stories, highlights] = await Promise.all([
    fetchAll(TABLE.series, SELECT.series, userId, "loadBoard/series"),
    fetchAll(TABLE.post, SELECT.post, userId, "loadBoard/posts"),
    fetchAll(TABLE.story, SELECT.story, userId, "loadBoard/stories"),
    fetchAll(TABLE.highlight, SELECT.highlight, userId, "loadBoard/highlights"),
  ])

  return {
    series: series.map(r => fromRow<Series>(SERIES_COLUMNS, r)),
    posts: posts.map(r => fromRow<Post>(POST_COLUMNS, r)),
    stories: stories.map(r => fromRow<Story>(STORY_COLUMNS, r)),
    highlights: highlights.map(r => fromRow<Highlight>(HIGHLIGHT_COLUMNS, r)),
  }
}
