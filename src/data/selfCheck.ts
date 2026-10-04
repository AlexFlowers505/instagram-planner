import type { Board, Highlight, Post, Series, Story } from "../types/model"
import { loadBoard } from "./load"
import { applyWriteOp, collapse, opDelete, opUpsert } from "./ops"
import { RANK_STEP, rankBetween } from "../lib/rank"

/**
 * Разовая проверка слоя данных против живой базы.
 *
 * **Временная.** Она существует, потому что в `001_schema.sql` есть два
 * триггера и четыре ограничения, которые ни разу не выполнялись, а слой записи
 * ни разу не писал. Удаляется, когда доска начнёт делать всё это по-настоящему
 * — то есть после пункта 2.
 *
 * Заводит свои строки, проверяет и **убирает за собой**. Чужого не трогает:
 * удаляются только те id, которые она сама и создала.
 */

export type CheckResult = { name: string; ok: boolean; detail: string }

const uid = () => crypto.randomUUID()
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Шаг, который должен пройти. */
async function expectOk(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  try {
    return { name, ok: true, detail: await fn() }
  } catch (e) {
    return { name, ok: false, detail: msg(e) }
  }
}

/** Шаг, который база обязана отвергнуть. Прошёл — значит защита не работает. */
async function expectFail(name: string, needle: string, fn: () => Promise<unknown>): Promise<CheckResult> {
  try {
    await fn()
    return { name, ok: false, detail: "база приняла то, что должна была отвергнуть" }
  } catch (e) {
    const text = msg(e)
    return {
      name,
      ok: text.toLowerCase().includes(needle.toLowerCase()),
      detail: text.slice(0, 160),
    }
  }
}

export async function runSelfCheck(userId: string): Promise<CheckResult[]> {
  const out: CheckResult[] = []

  const rootId = uid()
  const plotId = uid()
  const postA = uid()
  const postB = uid()
  const storyId = uid()
  const highlightId = uid()

  const root: Series = { id: rootId, parentId: null, name: "Проверка", color: "#3E7C8C", kind: "finite" }
  const plot: Series = { id: plotId, parentId: rootId, name: "Сюжет проверки", color: null, kind: null }

  const mkPost = (id: string, rank: number | null, status: Post["status"]): Post => ({
    id, seriesId: plotId, format: "carousel", status,
    archived: false, publishedOn: null, targetOn: null, rank,
    heading: "проверка", subheading: "", tags: ["проверка"], coverPath: null,
  })

  // Доска, из которой `applyWriteOp` берёт содержимое. Так проверяется весь
  // путь записи, а не прямой вызов клиента.
  const board: Board = { series: [], posts: [], stories: [], highlights: [] }
  const write = (op: Parameters<typeof applyWriteOp>[2]) => applyWriteOp(board, userId, op)

  try {
    out.push(await expectOk("Чтение доски", async () => {
      const b = await loadBoard(userId)
      return `${b.series.length} серий, ${b.posts.length} постов, ${b.stories.length} сторис, ${b.highlights.length} актуальных`
    }))

    out.push(await expectOk("Запись серии", async () => {
      board.series.push(root)
      await write(opUpsert("series", rootId))
      return "создана"
    }))

    out.push(await expectOk("Сюжет внутри серии", async () => {
      board.series.push(plot)
      await write(opUpsert("series", plotId))
      return "создан"
    }))

    out.push(await expectFail("Третий уровень отвергнут", "вложенность", async () => {
      const deep: Series = { id: uid(), parentId: plotId, name: "Третий", color: null, kind: null }
      board.series.push(deep)
      await write(opUpsert("series", deep.id))
    }))

    out.push(await expectFail("Цвет у сюжета отвергнут", "series_root_fields", async () => {
      const bad: Series = { id: uid(), parentId: rootId, name: "С цветом", color: "#000000", kind: "finite" }
      board.series.push(bad)
      await write(opUpsert("series", bad.id))
    }))

    out.push(await expectFail("Запланированный без ранга отвергнут", "posts_planned_has_rank", async () => {
      const bad = mkPost(uid(), null, "planned")
      board.posts.push(bad)
      await write(opUpsert("post", bad.id))
    }))

    out.push(await expectOk("Два поста в очередь", async () => {
      board.posts.push(mkPost(postA, RANK_STEP, "planned"), mkPost(postB, RANK_STEP * 2, "planned"))
      await write(opUpsert("post", postA))
      await write(opUpsert("post", postB))
      return `ранги ${RANK_STEP} и ${RANK_STEP * 2}`
    }))

    out.push(await expectOk("Перестановка — одна строка", async () => {
      // Поставить B перед A: трогается только B, как и обещает ADR 0002.
      const moved = rankBetween(null, RANK_STEP)
      const b = board.posts.find(p => p.id === postB)!
      b.rank = moved
      await write(opUpsert("post", postB))
      const fresh = await loadBoard(userId)
      const order = fresh.posts
        .filter(p => p.id === postA || p.id === postB)
        .sort((x, y) => (x.rank ?? 0) - (y.rank ?? 0))
        .map(p => (p.id === postA ? "A" : "B"))
      return `порядок ${order.join(" → ")}, ранг B = ${moved}`
    }))

    out.push(await expectOk("Схлопывание очереди", async () => {
      const ops = [opUpsert("post", postA), opUpsert("post", postA), opUpsert("post", postA)]
      const collapsed = collapse(ops)
      return collapsed.length === 1 ? "три правки одной строки → одна запись" : `ожидалась одна, вышло ${collapsed.length}`
    }))

    out.push(await expectFail("Две привязки у сторис отвергнуты", "stories_one_attachment", async () => {
      const bad: Story = {
        id: uid(), attachPostId: postA, attachSeriesId: rootId,
        role: "behind", onDate: null, body: "нельзя",
      }
      board.stories.push(bad)
      await write(opUpsert("story", bad.id))
    }))

    out.push(await expectOk("Сторис и актуальное", async () => {
      const story: Story = {
        id: storyId, attachPostId: null, attachSeriesId: rootId,
        role: "behind", onDate: null, body: "закулисье проверки",
      }
      const hl: Highlight = {
        id: highlightId, seriesId: rootId, name: "Актуальное проверки",
        coverPath: null, assembled: false, storyIds: [storyId],
      }
      board.stories.push(story)
      board.highlights.push(hl)
      await write(opUpsert("story", storyId))
      await write(opUpsert("highlight", highlightId))
      return "созданы, сторис внутри актуального"
    }))

    out.push(await expectOk("Удалённая сторис уходит из актуального", async () => {
      await write(opDelete("story", storyId))
      const fresh = await loadBoard(userId)
      const hl = fresh.highlights.find(h => h.id === highlightId)
      if (!hl) return "актуальное пропало — так быть не должно"
      return hl.storyIds.length === 0
        ? "триггер вычистил ссылку"
        : `ссылка осталась: ${hl.storyIds.join(", ")}`
    }))
  } finally {
    // Убрать за собой в любом случае, включая упавшие шаги.
    const ids: Array<[Parameters<typeof opDelete>[0], string]> = [
      ["highlight", highlightId],
      ["story", storyId],
      ["post", postA],
      ["post", postB],
      ["series", plotId],
      ["series", rootId],
    ]
    const failed: string[] = []
    for (const [entity, id] of ids) {
      try {
        await applyWriteOp(board, userId, opDelete(entity, id))
      } catch (e) {
        failed.push(`${entity}: ${msg(e)}`)
      }
    }
    out.push({
      name: "Уборка",
      ok: failed.length === 0,
      detail: failed.length === 0 ? "все проверочные строки удалены" : failed.join("; "),
    })
  }

  return out
}
