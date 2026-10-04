import { useState } from "react"
import { ArrowUpDown, Grid2x2, LayoutGrid, Type } from "lucide-react"
import type { Board, Post } from "../types/model"
import { seriesLookup } from "../lib/series"
import { boardPosts, clashesOf, ideas, posted, queue, rhythm } from "../lib/feed"
import { plural } from "../lib/date"
import type { Density } from "../ui/formats"
import { useQueueDrag } from "../ui/useQueueDrag"
import { Tile } from "./Tile"

/**
 * Сетка профиля: три в ряд, 4:5, **новое слева сверху** — как увидит зритель.
 * Прошлое стоит по своим датам, будущее — в порядке очереди (ADR 0003).
 */

const DENSITIES: Array<{ id: Density; icon: typeof Type; title: string }> = [
  { id: "captions", icon: Type, title: "С подписями" },
  { id: "covers", icon: Grid2x2, title: "Только обложки" },
  { id: "flush", icon: LayoutGrid, title: "Как в ленте — вплотную, без наших пометок" },
]

/** Три независимых слоя подписи: состав, замысел и разметка — разные вопросы. */
const CAPTION_PARTS: Array<{ id: "subheading" | "description" | "tags"; label: string }> = [
  { id: "subheading", label: "подзаголовок" },
  { id: "description", label: "описание" },
  { id: "tags", label: "метки" },
]

const GAP: Record<Density, string> = {
  captions: "gap-x-[6px] gap-y-[18px]",
  covers: "gap-[6px]",
  flush: "gap-[2px]",
}

type Props = {
  board: Board
  today: string
  onOpen: (id: string) => void
  /** `to` — место в очереди по рангу, не на экране. */
  onMove?: (id: string, to: number) => void
  /** Путь обложки → подписанная ссылка. */
  covers?: Map<string, string>
}

export function Feed({ board, today, onOpen, onMove, covers }: Props) {
  const coverOf = (p: Post) => (p.coverPath ? covers?.get(p.coverPath) : undefined)
  const [density, setDensity] = useState<Density>("captions")
  const [profileOrder, setProfileOrder] = useState(true)
  // Подзаголовок, описание и метки — три разных вопроса к одной сетке,
  // поэтому три отдельных переключателя, а не один «подробнее».
  const [shows, setShows] = useState({ subheading: false, description: false, tags: false })

  const series = seriesLookup(board)
  const posts = boardPosts(board)
  const out = posted(posts)
  const inQueue = queue(posts)
  const shelf = ideas(posts)
  const beat = rhythm(posts)

  const storiesOf = (postId: string) => board.stories.filter(s => s.attachPostId === postId)

  // «Как в профиле» — обратный порядок: новое слева сверху. Очередь при этом
  // идёт первой, потому что её хвост и есть самое новое.
  const shownQueue = profileOrder ? [...inQueue].reverse() : inQueue

  const drag = useQueueDrag(
    shownQueue.map(p => p.id),
    (id, at) => {
      // На экране порядок может быть перевёрнут, а ранг — нет.
      onMove?.(id, profileOrder ? shownQueue.length - 1 - at : at)
    },
  )

  const byId = new Map(posts.map(p => [p.id, p]))
  const carriedQueue: Post[] = drag.order
    ? drag.order.map(id => byId.get(id)).filter((p): p is Post => Boolean(p))
    : shownQueue

  const sequence = profileOrder
    ? [...carriedQueue, ...[...out].reverse()]
    : [...out, ...carriedQueue]
  const todayAt = sequence.findIndex(p => (profileOrder ? p.status === "posted" : p.status !== "posted"))

  const anyClash = inQueue.some(p => clashesOf(p, inQueue, today).length > 0)

  // Идеи стоят рядом с очередью, а не в конце страницы: они её продолжение —
  // то, что ещё не встало в ряд. «Как в профиле» очередь сверху, значит и
  // полка сверху; по порядку выхода очередь внизу, и полка уходит вниз.
  const shelfBlock = shelf.length > 0 && density !== "flush" && (
    <section className={profileOrder ? "mb-6 max-w-[720px]" : "mt-6 max-w-[720px]"}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-[10.5px] font-medium tracking-[0.07em] text-ink/45 uppercase">
          Идеи без даты
        </span>
        <span className="text-[11.5px] tabular-nums text-ink/45">{shelf.length}</span>
      </div>
      <div className={`grid grid-cols-3 ${GAP[density]}`}>
        {shelf.map(post => (
          <Tile
            key={post.id}
            post={post}
            series={series}
            stories={storiesOf(post.id)}
            clashes={[]}
            density={density}
            cover={coverOf(post)}
            shows={shows}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-3.5 pb-3">
        <h2 className="font-ed text-[16px] font-semibold tracking-[-0.015em]">Сетка профиля</h2>
        <span className="text-[11.5px] tabular-nums text-ink/45">{sequence.length}</span>
        {anyClash && (
          <span className="text-[11.5px] text-warn" title="Ориентир спорит с очередью — доска показывает, но не исправляет">
            есть расхождения
          </span>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setProfileOrder(v => !v)}
          aria-pressed={!profileOrder}
          title={profileOrder ? "Сейчас как в профиле — развернуть по порядку выхода" : "Сейчас по порядку выхода — вернуть как в профиле"}
          className="grid h-7 w-7 place-items-center rounded-lg text-ink/45 hover:bg-ink/[0.05] hover:text-ink"
        >
          <ArrowUpDown size={15} strokeWidth={1.9} />
        </button>

        {/* Видно только там, где подпись вообще есть. */}
        {density === "captions" && (
          <div className="flex gap-1">
            {CAPTION_PARTS.map(part => (
              <button
                key={part.id}
                type="button"
                onClick={() => setShows(was => ({ ...was, [part.id]: !was[part.id] }))}
                aria-pressed={shows[part.id]}
                className={`rounded-full px-2 py-1 text-[11px] transition-colors ${
                  shows[part.id]
                    ? "bg-ink text-on-fill"
                    : "bg-ink/[0.05] text-ink/45 hover:text-ink"
                }`}
              >
                {part.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-0.5 rounded-full bg-ink/[0.05] p-0.5">
          {DENSITIES.map(d => {
            const Icon = d.icon
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDensity(d.id)}
                aria-pressed={density === d.id}
                title={d.title}
                aria-label={d.title}
                className={`grid place-items-center rounded-full px-[7px] py-1 transition-colors ${
                  density === d.id ? "bg-surface text-ink shadow-sm" : "text-ink/70 hover:text-ink"
                }`}
              >
                <Icon size={14} strokeWidth={1.8} />
              </button>
            )
          })}
        </div>
      </div>

      {posts.length === 0 && (
        <p className="max-w-[52ch] text-[13px] text-ink/70">
          Доска пустая. Заведи первый пост кнопкой сверху — или открой{" "}
          <code className="text-ink">?demo=1</code>, чтобы посмотреть, как сетка
          выглядит с содержимым.
        </p>
      )}

      {profileOrder && shelfBlock}

      <div className={`grid max-w-[720px] grid-cols-3 ${GAP[density]}`}>
        {sequence.map((post, i) => {
          const movable = Boolean(onMove) && post.status === "planned"
          return (
            <Fragmented key={post.id} divider={i === todayAt}>
              <Tile
                post={post}
                series={series}
                stories={storiesOf(post.id)}
                clashes={clashesOf(post, inQueue, today)}
                density={density}
                cover={coverOf(post)}
                shows={shows}
                onOpen={id => {
                  // Отпускание после переноса — это не клик по посту.
                  if (!drag.justDragged()) onOpen(id)
                }}
                movable={movable}
                elementRef={movable ? el => drag.register(post.id, el) : undefined}
                onPointerDown={movable ? e => drag.onPointerDown(e, post.id) : undefined}
              />
            </Fragmented>
          )
        })}
        {todayAt === -1 && sequence.length > 0 && <Divider />}
      </div>

      {!profileOrder && shelfBlock}

      <p className="mt-8 max-w-[60ch] text-[11.5px] tabular-nums text-ink/45">
        карусели {beat.byFormat.carousel} · фото {beat.byFormat.single} · рилсы {beat.byFormat.reel}
        {beat.longestRun && beat.longestRun.length >= 3 && (
          <> · подряд <b className="font-medium text-ink/70">{beat.longestRun.length}</b> одного формата</>
        )}
        {beat.longestGap && beat.longestGap.days >= 10 && (
          <> · пауза <b className="font-medium text-ink/70">
            {beat.longestGap.days} {plural(beat.longestGap.days, "день", "дня", "дней")}
          </b></>
        )}
      </p>
    </>
  )
}

function Divider() {
  return (
    <div className="col-span-full flex items-center gap-2.5 py-1 text-[10.5px] font-medium tracking-[0.07em] text-ink/28 uppercase">
      сегодня
      <span className="h-px flex-1 bg-ink/10" />
    </div>
  )
}

/** Черта «сегодня» занимает всю строку сетки, поэтому она сестра плитки, а не обёртка. */
function Fragmented({ divider, children }: { divider: boolean; children: React.ReactNode }) {
  return (
    <>
      {divider && <Divider />}
      {children}
    </>
  )
}
