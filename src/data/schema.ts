import type { Highlight, Post, Series, Story } from "../types/model"

/**
 * Единственное место, которое знает, что на сервере это четыре таблицы со
 * змеиными именами колонок.
 *
 * Карта колонок — `Record<keyof T, string>`, и это сделано ради одной вещи:
 * **добавил поле в модель — перестало компилироваться, пока не назвал
 * колонку**. Отсюда же строится и список для `select`, и строка для записи,
 * так что забыть поле в одном из трёх мест нельзя. Остаётся только сама
 * колонка в SQL, и её отсутствие — это не пустое значение, а сломанное
 * чтение, то есть видно сразу.
 */

type Cols<T> = Record<keyof T, string>

export type Entity = "series" | "post" | "story" | "highlight"

export const TABLE: Record<Entity, string> = {
  series: "series",
  post: "posts",
  story: "stories",
  highlight: "highlights",
}

export const SERIES_COLUMNS: Cols<Series> = {
  id: "id",
  parentId: "parent_id",
  name: "name",
  color: "color",
  kind: "kind",
}

export const POST_COLUMNS: Cols<Post> = {
  id: "id",
  seriesId: "series_id",
  format: "format",
  status: "status",
  archived: "archived",
  publishedOn: "published_on",
  targetOn: "target_on",
  rank: "rank",
  heading: "heading",
  subheading: "subheading",
  tags: "tags",
  coverPath: "cover_path",
}

export const STORY_COLUMNS: Cols<Story> = {
  id: "id",
  attachPostId: "attach_post_id",
  attachSeriesId: "attach_series_id",
  role: "role",
  onDate: "on_date",
  body: "body",
}

export const HIGHLIGHT_COLUMNS: Cols<Highlight> = {
  id: "id",
  seriesId: "series_id",
  name: "name",
  coverPath: "cover_path",
  assembled: "assembled",
  storyIds: "story_ids",
}

/** Карта колонок по сущности — для записи, где тип строки известен только в рантайме. */
export const COLUMNS_OF: Record<Entity, Record<string, string>> = {
  series: SERIES_COLUMNS,
  post: POST_COLUMNS,
  story: STORY_COLUMNS,
  highlight: HIGHLIGHT_COLUMNS,
}

/** Список колонок для `select`. Собирается из карты, руками не пишется. */
export const selectOf = (cols: Record<string, string>) => Object.values(cols).join(",")

export const SELECT: Record<Entity, string> = {
  series: selectOf(SERIES_COLUMNS),
  post: selectOf(POST_COLUMNS),
  story: selectOf(STORY_COLUMNS),
  highlight: selectOf(HIGHLIGHT_COLUMNS),
}

type Row = Record<string, unknown>

/** Строка для записи: модель плюс владелец, которого в модели нет. */
export function toRow<T extends object>(cols: Cols<T>, value: T, userId: string): Row {
  const out: Row = { user_id: userId }
  for (const k of Object.keys(cols) as (keyof T)[]) out[cols[k]] = value[k]
  return out
}

/**
 * Модель из строки. Приведение типа здесь одно на весь проект и стоит на том,
 * что карта колонок и SQL описывают одно и то же: SQL проверяется чтением,
 * а карта — компилятором.
 */
export function fromRow<T extends object>(cols: Cols<T>, row: Row): T {
  const out = {} as T
  for (const k of Object.keys(cols) as (keyof T)[]) out[k] = row[cols[k]] as T[keyof T]
  return out
}
