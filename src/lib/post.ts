import type { Post, Status } from "../types/model"
import { todayKey } from "./date"
import { rankBetween } from "./rank"

/**
 * Три поля поста, которые нельзя заполнять по отдельности: день выхода,
 * ориентир и ранг. Их согласованность — не вкус формы, а **ограничения базы**
 * (`posts_posted_has_day`, `posts_planned_has_rank`, `posts_idea_is_bare`), и
 * считать их в двух местах значило бы однажды разойтись с ними в одном.
 *
 * `was` — пост до правки или `null` при заведении. Он нужен ради двух вещей,
 * которых из формы не видно: **ранг не пересчитывается** у того, кто уже стоит
 * в очереди (иначе правка заголовка перебрасывала бы пост в конец), и
 * **ориентир переживает публикацию** — чтобы «собирался 10-го, вышло 12-го»
 * осталось видно (ADR 0003).
 */
export function postShape(
  status: Status,
  day: string,
  was: Post | null,
  lastRank: number | null,
): Pick<Post, "publishedOn" | "targetOn" | "rank"> {
  // У идеи нет дня: ни настоящего, ни ориентира — места в очереди, из которого
  // он взялся бы, у неё тоже нет. Ранг при этом есть: он держит порядок полки,
  // а `lastRank` для идеи — последняя идея, не последний запланированный.
  if (status === "idea") {
    return { publishedOn: null, targetOn: null, rank: was?.rank ?? rankBetween(lastRank, null) }
  }

  if (status === "posted") {
    return {
      publishedOn: day || was?.publishedOn || todayKey(),
      targetOn: was?.targetOn ?? null,
      rank: null,
    }
  }

  return {
    publishedOn: null,
    targetOn: day || null,
    rank: was?.rank ?? rankBetween(lastRank, null),
  }
}
