import type { Board, Post, Story } from "../types/model"
import { boardPosts, clashesOf, queue, shownDate } from "../lib/feed"
import { seriesLookup } from "../lib/series"
import { addDays, daysBetween, fmtDay, mondayOf, plural } from "../lib/date"
import { FORMAT_ICON } from "../ui/formats"

/**
 * Вид «Срок»: **нет ли дырок во времени и насколько вперёд набрано**.
 *
 * Недели идут подряд, **включая пустые**: пустая неделя — такой же факт, как
 * заполненная, и вид, который её пропускает, прячет единственное, за чем сюда
 * приходят.
 *
 * У недели **две независимые строки** — «ни одной публикации» и «ни одной
 * сторис». Склеивать их нельзя: месяц сторис без единого поста не должен
 * выглядеть благополучным.
 *
 * Пост без ориентира сюда не попадает — ему негде стоять. Это не потеря: он
 * виден в очереди, а здесь речь о времени.
 */

/** Неделя показывается, если она попала между первой и последней непустой. */
function weeksOf(days: string[], today: string): string[] {
  const all = [...days, today].sort()
  const first = mondayOf(all[0])
  const last = mondayOf(all[all.length - 1])
  const out: string[] = []
  for (let w = first; w <= last; w = addDays(w, 7)) out.push(w)
  return out
}

export function DueView({
  board,
  today,
  onOpen,
}: {
  board: Board
  today: string
  onOpen: (id: string) => void
}) {
  const lookup = seriesLookup(board)
  const posts = boardPosts(board)
  const inQueue = queue(posts)

  const dated = posts.filter(p => shownDate(p) !== null)
  const stories = board.stories.filter(s => s.onDate !== null)

  const days = [
    ...dated.map(p => shownDate(p)!),
    ...stories.map(s => s.onDate!),
  ]
  if (days.length === 0) {
    return (
      <p className="max-w-[52ch] pt-4 text-[13px] text-ink/70">
        Ни у одного поста нет дня — ни настоящего, ни ориентира. Срок покажет
        что-нибудь, когда появится хотя бы один.
      </p>
    )
  }

  const thisWeek = mondayOf(today)

  return (
    <div className="max-w-[720px] pt-3.5">
      {weeksOf(days, today).map(week => {
        const till = addDays(week, 7)
        const ofWeek = (d: string | null) => d !== null && d >= week && d < till

        const here: Post[] = dated.filter(p => ofWeek(shownDate(p)))
        const told: Story[] = stories.filter(s => ofWeek(s.onDate))
        const now = week === thisWeek

        return (
          <section
            key={week}
            className={`grid grid-cols-[82px_1fr] gap-3 border-t py-2.5 ${
              now ? "border-ink/28" : "border-ink/10"
            }`}
          >
            <div className="pt-0.5">
              <div className={`text-[11.5px] tabular-nums ${now ? "text-ink" : "text-ink/45"}`}>
                {fmtDay(week)}
              </div>
              {now && (
                <div className="text-[10.5px] tracking-[0.06em] text-ink/45 uppercase">сейчас</div>
              )}
            </div>

            <div className="grid gap-1">
              {here.length === 0 ? (
                <p className="text-[11.5px] text-ink/28">ни одной публикации</p>
              ) : (
                here.map(p => {
                  const Icon = FORMAT_ICON[p.format]
                  const clashes = clashesOf(p, inQueue, today)
                  const day = shownDate(p)!
                  const ahead = p.status === "planned" ? daysBetween(today, day) : 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left hover:bg-ink/[0.05]"
                    >
                      <span
                        className="h-2 w-2 translate-y-px rounded-sm"
                        style={{ background: lookup.colorOf(p.seriesId) }}
                      />
                      <Icon size={12} strokeWidth={1.9} className="translate-y-px text-ink/45" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.heading}</span>
                      {clashes.length > 0 && (
                        <span
                          className="text-[10.5px] text-warn"
                          title={clashes.map(c => c.text).join("; ")}
                        >
                          расхождение
                        </span>
                      )}
                      <span className="text-[10.5px] tabular-nums text-ink/45">
                        {p.status === "planned" && ahead > 0
                          ? `через ${ahead} ${plural(ahead, "день", "дня", "дней")}`
                          : fmtDay(day)}
                      </span>
                    </button>
                  )
                })
              )}

              {/* Вторая строка — своя: сторис не закрывают дырку в постах. */}
              {told.length === 0 ? (
                <p className="text-[11.5px] text-ink/28">ни одной сторис</p>
              ) : (
                <p className="px-1.5 text-[11.5px] text-ink/70">
                  {told.length} {plural(told.length, "сторис", "сторис", "сторис")}
                  <span className="text-ink/45"> · {told.map(s => s.body || "без текста").join(" · ")}</span>
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
