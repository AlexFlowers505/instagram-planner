import type { Board } from "../types/model"
import { COLUMNS_OF, type Entity, TABLE, toRow } from "./schema"
import { client, unwrap } from "./supabase"

/**
 * Операция записи называет **какую строку** тронули, а не что в ней лежит.
 *
 * Это и есть условие из ADR 0002. Содержимое читается из доски в момент
 * отправки, поэтому десять правок одного поста подряд схлопываются в одну
 * запись, и ни при каких обстоятельствах на сервер не уезжает весь проект —
 * ошибка, на которой TimeLens однажды отправлял целый журнал из-за пробела в
 * текстовом поле.
 */

export type WriteOp =
  | { kind: "upsert"; entity: Entity; id: string }
  | { kind: "delete"; entity: Entity; id: string }

export const opUpsert = (entity: Entity, id: string): WriteOp => ({ kind: "upsert", entity, id })
export const opDelete = (entity: Entity, id: string): WriteOp => ({ kind: "delete", entity, id })

/**
 * Ключ схлопывания — сущность и строка, **без вида операции**: у одной строки
 * в очереди всегда ровно одно последнее намерение. Правка после удаления
 * означает, что строку завели заново; удаление после правки отменяет её.
 */
export const opKey = (op: WriteOp) => `${op.entity}:${op.id}`

/** Последняя операция на каждую строку, в порядке первого появления. */
export function collapse(ops: Iterable<WriteOp>): WriteOp[] {
  const byRow = new Map<string, WriteOp>()
  for (const op of ops) byRow.set(opKey(op), op)
  return [...byRow.values()]
}

function findRow(board: Board, entity: Entity, id: string): object | undefined {
  switch (entity) {
    case "series": return board.series.find(x => x.id === id)
    case "post": return board.posts.find(x => x.id === id)
    case "story": return board.stories.find(x => x.id === id)
    case "highlight": return board.highlights.find(x => x.id === id)
  }
}

/**
 * Содержимое берётся из доски **сейчас**, а не из того, какой она была, когда
 * операцию поставили в очередь. Отсюда и схлопывание.
 */
export async function applyWriteOp(board: Board, userId: string, op: WriteOp): Promise<void> {
  const table = TABLE[op.entity]

  if (op.kind === "delete") {
    const res = await client().from(table).delete().eq("id", op.id).eq("user_id", userId)
    unwrap(`delete/${op.entity}`, res)
    return
  }

  const value = findRow(board, op.entity, op.id)
  // Строки уже нет: её успели удалить, пока операция ждала отправки. Это не
  // ошибка — просто писать нечего.
  if (!value) return

  const row = toRow(COLUMNS_OF[op.entity], value as Record<string, unknown>, userId)
  const res = await client().from(table).upsert(row, { onConflict: "id" })
  unwrap(`upsert/${op.entity}`, res)
}
