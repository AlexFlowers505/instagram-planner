import { Lightbulb, Pencil } from "lucide-react"
import type { Post, Story } from "../types/model"
import type { SeriesLookup } from "../lib/series"
import { placeholderCover } from "../lib/cover"
import { type Clash, shownDate } from "../lib/feed"
import { fmtDay, plural } from "../lib/date"
import { type Density, FORMAT_ICON, FORMAT_LABEL } from "../ui/formats"

/**
 * Плитка поста в сетке профиля.
 *
 * Пропорция 4:5 с обрезкой по центру — **так покажет профиль**, и видеть эту
 * обрезку и есть смысл. Имени серии здесь нет: его несёт цвет рейки, а
 * повторённое под каждой картинкой оно и было тем шумом, из-за которого сетка
 * переставала читаться.
 */

type Props = {
  post: Post
  series: SeriesLookup
  stories: Story[]
  clashes: Clash[]
  density: Density
  onOpen: (id: string) => void
  /** Подписанная ссылка на обложку. Нет — рисуется заглушка цветом серии. */
  cover?: string
  /** Что показывать в подписи сверх заголовка и даты. */
  shows?: { subheading: boolean; description: boolean; tags: boolean }
  /** Плитку можно нести — то есть она в очереди. */
  movable?: boolean
  elementRef?: (el: HTMLButtonElement | null) => void
  onPointerDown?: (e: React.PointerEvent) => void
}

export function Tile({
  post,
  series,
  stories,
  clashes,
  density,
  onOpen,
  cover,
  shows,
  movable,
  elementRef,
  onPointerDown,
}: Props) {
  const color = series.colorOf(post.seriesId)
  const Icon = FORMAT_ICON[post.format]
  const day = shownDate(post)
  const isIdea = post.status === "idea"
  const flush = density === "flush"

  const title = [series.pathOf(post.seriesId).join(" → "), FORMAT_LABEL[post.format]]
    .filter(Boolean)
    .join(" · ")

  return (
    <button
      type="button"
      ref={elementRef}
      onClick={() => onOpen(post.id)}
      onPointerDown={onPointerDown}
      title={movable ? `${title} — открыть, перетащить` : `${title} — открыть`}
      aria-label={`${post.heading} — открыть`}
      data-status={post.status}
      className="group grid gap-[7px] text-left transition-[translate] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
      style={{
        gridTemplateRows: density === "captions" ? "auto auto" : "auto",
        // Браузер не должен прокручивать страницу жестом, который мы уже
        // взяли себе; у неподвижных плиток прокрутка остаётся обычной.
        touchAction: movable ? "none" : undefined,
        cursor: movable ? "grab" : "pointer",
      }}
    >
      <span
        className={`relative block aspect-[4/5] max-w-full overflow-hidden bg-cover bg-center ${
          flush ? "rounded-none" : "rounded-lg"
        } ${post.status === "planned" && !flush ? "opacity-[0.74]" : ""} ${
          post.archived ? "opacity-[0.45]" : ""
        }`}
        style={{
          backgroundImage: cover
            ? `url("${cover}")`
            : isIdea
              ? undefined
              : placeholderCover(post.id, color),
          backgroundColor: isIdea ? "color-mix(in oklab, var(--color-ink) 4%, transparent)" : undefined,
          outline: !flush && post.status !== "posted" ? `1.5px dashed ${color}` : undefined,
          outlineOffset: "-1.5px",
        }}
      >
        {isIdea && !cover && (
          <span className="grid h-full w-full place-items-center opacity-50" style={{ color }}>
            <Lightbulb size={26} strokeWidth={1.7} />
          </span>
        )}

        {/* Рейка — это и есть серия на плитке. В «как в ленте» её нет: она наша,
            а не инстаграмовская, и ломает иллюзию, ради которой режим существует. */}
        {!flush && (
          <span className="absolute inset-y-0 left-0 z-[2] w-[3px]" style={{ background: color }} />
        )}

        {!flush && stories.length > 0 && (
          <span
            className="absolute top-1.5 left-2 z-[2] flex gap-[2.5px]"
            title={`${stories.length} ${plural(stories.length, "сторис", "сторис", "сторис")}`}
          >
            {stories.map(s => (
              <i key={s.id} className="block h-[2.5px] w-2.5 rounded-sm bg-white/85" />
            ))}
          </span>
        )}

        {post.archived && !flush && (
          <span className="absolute bottom-1.5 left-1.5 z-[2] rounded-full bg-[#0B0E12A0] px-1.5 py-px text-[9px] font-medium tracking-[0.05em] text-white uppercase backdrop-blur-sm">
            архив
          </span>
        )}

        {/* Плитка открывает пост на правку, и до этого об этом не говорило
            ничто — а узнать такое можно было только случайным кликом. Значок
            по наведению и фокусу: в покое его нет, поэтому сетка остаётся
            тихой, в том числе и в режиме «как в ленте». */}
        <span
          className="absolute bottom-[5px] right-[5px] z-[2] grid h-[19px] w-[19px] place-items-center rounded-md bg-[#0B0E12A0] text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <Pencil size={10} strokeWidth={2} />
        </span>

        {/* Значок формата остаётся даже вплотную: он есть и в настоящем профиле. */}
        <span
          className="absolute top-[5px] right-[5px] z-[2] grid h-[19px] w-[19px] place-items-center rounded-md bg-[#0B0E12A0] text-white backdrop-blur-sm"
          aria-label={FORMAT_LABEL[post.format]}
        >
          <Icon size={11} strokeWidth={1.9} />
        </span>
      </span>

      {density === "captions" && (
        /* Высота зарезервирована: строка сетки высотой с самую высокую подпись,
           поэтому рваные заголовки дали бы рваные строки. */
        <span className="grid min-h-[3.1rem] content-start gap-px">
          <span className="line-clamp-2 text-[12.5px] leading-[1.32] text-ink">{post.heading}</span>

          {shows?.subheading && post.subheading && (
            <span className="line-clamp-2 text-[11px] leading-[1.3] text-ink/70">
              {post.subheading}
            </span>
          )}

          {shows?.description && post.description && (
            <span className="line-clamp-3 text-[11px] leading-[1.3] text-ink/45">
              {post.description}
            </span>
          )}

          {shows?.tags && post.tags.length > 0 && (
            <span className="truncate text-[10.5px] text-ink/45">
              {post.tags.join(" · ")}
            </span>
          )}
          {!isIdea && (
            <span
              className={`text-[10.5px] tabular-nums ${clashes.length ? "text-warn" : "text-ink/45"}`}
              title={clashes.length ? clashes.map(c => c.text).join("; ") : undefined}
            >
              {clashes.length > 0 && (
                <i className="mr-[3px] inline-block h-[5px] w-[5px] rounded-full bg-warn align-[1px]" />
              )}
              {post.status === "posted"
                ? fmtDay(day)
                : day
                  ? `~${fmtDay(day)}`
                  : "без ориентира"}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
