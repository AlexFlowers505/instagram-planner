import type { Board, Post, Series } from "../types/model"
import { NO_SERIES, seriesLookup } from "../lib/series"
import { boardPosts, shownDate } from "../lib/feed"
import { fmtDay, plural } from "../lib/date"
import { FORMAT_ICON, FORMAT_LABEL } from "../ui/formats"

/**
 * Вид «Серии»: **разворачивается ли замысел**.
 *
 * Порядок здесь всегда хронологический — серия это рассказ, а рассказ читают с
 * начала. Поэтому очередь и вышедшее идут одной лентой по дню, какой у поста
 * виден, а не двумя списками, как в сетке.
 *
 * Две строки сверх постов обязательны: сторис, привязанные к серии (закулисье
 * относится ко всей поездке и без этой строки не видно нигде), и актуальное.
 */

const KIND: Record<string, string> = {
  finite: "конечная",
  rubric: "рубрика",
}

/** По дню, какой у поста виден; без дня — в конец, это идеи. */
const byDay = (a: Post, b: Post) => (shownDate(a) ?? "9999").localeCompare(shownDate(b) ?? "9999")

export function SeriesView({ board, onOpen }: { board: Board; onOpen: (id: string) => void }) {
  const lookup = seriesLookup(board)
  const posts = boardPosts(board)

  const inSeries = (id: string | null) => posts.filter(p => p.seriesId === id).sort(byDay)

  const roots: Series[] = [...lookup.roots, NO_SERIES]

  return (
    <div className="max-w-[720px] pt-3.5">
      {roots.map(root => {
        const own = inSeries(root.id === NO_SERIES.id ? null : root.id)
        const plots = root.id === NO_SERIES.id ? [] : lookup.childrenOf(root.id)
        const total = own.length + plots.reduce((n, p) => n + inSeries(p.id).length, 0)
        if (total === 0) return null

        const color = root.color ?? lookup.colorOf(root.id)
        const stories = board.stories.filter(
          s => s.attachSeriesId === root.id || plots.some(p => p.id === s.attachSeriesId),
        )
        const highlights = board.highlights.filter(h =>
          root.id === NO_SERIES.id ? h.seriesId === null : h.seriesId === root.id,
        )

        return (
          <section key={root.id} className="mb-7">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
              <h3 className="font-ed text-[15px] font-semibold tracking-[-0.015em]">{root.name}</h3>
              {root.id !== NO_SERIES.id && root.kind && (
                <span className="text-[11.5px] text-ink/45">{KIND[root.kind]}</span>
              )}
              <span className="text-[11.5px] tabular-nums text-ink/45">
                {total} {plural(total, "пост", "поста", "постов")}
              </span>
            </div>

            <Run posts={own} onOpen={onOpen} />

            {plots.map(plot => {
              const kids = inSeries(plot.id)
              if (kids.length === 0) return null
              return (
                <div key={plot.id} className="mt-3 border-l-2 pl-3" style={{ borderColor: color }}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <h4 className="text-[13px] font-medium">{plot.name}</h4>
                    <span className="text-[11px] tabular-nums text-ink/45">{kids.length}</span>
                  </div>
                  <Run posts={kids} onOpen={onOpen} />
                </div>
              )
            })}

            {stories.length > 0 && (
              <p className="mt-2.5 text-[11.5px] text-ink/70">
                <span className="text-ink/45">сторис серии: </span>
                {stories.map(s => s.body || "без текста").join(" · ")}
              </p>
            )}

            {highlights.length > 0 && (
              <p className="mt-1 text-[11.5px] text-ink/70">
                <span className="text-ink/45">актуальное: </span>
                {highlights
                  .map(h => `${h.name}${h.assembled ? "" : " (не собрано)"}`)
                  .join(" · ")}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Run({ posts, onOpen }: { posts: Post[]; onOpen: (id: string) => void }) {
  return (
    <ul className="grid gap-px">
      {posts.map(p => {
        const Icon = FORMAT_ICON[p.format]
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left hover:bg-ink/[0.05]"
            >
              <Icon size={12} strokeWidth={1.9} className="translate-y-px text-ink/45" aria-label={FORMAT_LABEL[p.format]} />
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.heading}</span>
              <span className="text-[10.5px] tabular-nums text-ink/45">
                {p.status === "posted"
                  ? fmtDay(p.publishedOn)
                  : p.status === "planned"
                    ? p.targetOn
                      ? `~${fmtDay(p.targetOn)}`
                      : "в очереди"
                    : "идея"}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
