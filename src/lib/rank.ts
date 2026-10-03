/**
 * Дробный ранг: место поста в очереди.
 *
 * Условие из ADR 0002 — одна правка стоит одной записи. Целое `position` на
 * каждом посте стоило бы до двадцати: передвинул один, переписал все, что за
 * ним. Между двумя дробными числами место есть всегда, поэтому вставка трогает
 * **ровно одну строку** — свою.
 *
 * Цена записана там же: числа сближаются. Если тысячу раз двигать пост в одно
 * и то же место, точности перестанет хватать, и понадобится перенумеровать
 * очередь одного владельца целиком. Это единственное место, где запись трогает
 * много строк сразу — зато по расписанию, а не на каждый чих.
 */

/** Шаг между соседями, когда очередь строится с нуля или растёт с краю. */
export const RANK_STEP = 1024

/**
 * Ниже этого зазора делить бессмысленно: `(a + b) / 2` вернёт одно из них,
 * и два поста окажутся на одном месте. Порог с запасом: у double около
 * пятнадцати значащих цифр, а здесь взято девять.
 */
const MIN_GAP = 1e-9

/** Можно ли ещё поставить что-то между этими двумя. */
export function canSplit(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return true
  return after - before > MIN_GAP
}

/**
 * Ранг для места между двумя соседями. `null` означает край очереди:
 * `rankBetween(null, first)` — в начало, `rankBetween(last, null)` — в конец.
 *
 * Бросает, если зазор исчерпан: это сигнал перенумеровать, а не повод молча
 * положить два поста на одно место.
 */
export function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0
  if (before === null) return after! - RANK_STEP
  if (after === null) return before + RANK_STEP
  if (!canSplit(before, after)) {
    throw new RangeError("Зазор между рангами исчерпан — нужна перенумерация очереди")
  }
  return (before + after) / 2
}

/**
 * Пора ли перенумеровать. Проверяется по отсортированной очереди целиком:
 * достаточно одной слишком тесной пары.
 */
export function needsRenumber(sortedRanks: number[]): boolean {
  for (let i = 1; i < sortedRanks.length; i++) {
    if (!canSplit(sortedRanks[i - 1], sortedRanks[i])) return true
  }
  return false
}

/** Ровные ранги для очереди из `count` постов, по порядку. */
export function freshRanks(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * RANK_STEP)
}

/**
 * Куда встанет пост, если его перенести внутри очереди.
 *
 * `ranks` отсортированы по возрастанию, `from` — нынешнее место поста,
 * **`to` — место, которое он должен занять в итоговом порядке**, а не индекс
 * в списке без него. Разница в одну позицию при движении вперёд, и это ровно
 * то место, где ошибаются: взять индексы до удаления, а вставлять после —
 * значит промахнуться на единицу (см. `spec 001`, пункт 9).
 *
 * Возвращает `null`, если зазора не осталось: тогда очередь перенумеровывают
 * и считают заново.
 */
export function rankForMove(ranks: number[], from: number, to: number): number | null {
  const without = ranks.filter((_, i) => i !== from)
  const before = to > 0 ? (without[to - 1] ?? null) : null
  const after = without[to] ?? null
  if (!canSplit(before, after)) return null
  return rankBetween(before, after)
}
