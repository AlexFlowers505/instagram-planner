import { useEffect, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import type { Board, Story, StoryRole } from "../types/model"
import { seriesLookup } from "../lib/series"
import { feedOrder, boardPosts } from "../lib/feed"
import { CHOICE, DIALOG, FIELD, LABEL, PRIMARY, QUIET } from "../ui/form"

/**
 * Заведение и правка сторис.
 *
 * Сторис — **выпуск**, а не слайд: связка кадров на одну мысль (ADR 0004).
 * Поэтому полей здесь мало и ни одно из них не про кадры.
 *
 * Привязка и роль — **две независимые оси**, а не один список из четырёх
 * видов. Привязка одна из трёх (пост, серия, ничего) — это ограничение
 * `stories_one_attachment` в базе. Роль **необязательна**: у прогулки, из
 * которой ничего не вышло, её нет.
 */

type Hook = "post" | "series" | "none"

const ROLES: Array<{ id: StoryRole; label: string; hint: string }> = [
  { id: "teaser", label: "Подводка", hint: "До выхода поста" },
  { id: "pointer", label: "Отсылка", hint: "В день выхода" },
  { id: "behind", label: "Закулисье", hint: "О том, как это делалось" },
]

export function StoryForm({
  board,
  story,
  onSubmit,
  onDelete,
  onCancel,
}: {
  board: Board
  story?: Story
  onSubmit: (made: Story) => void
  onDelete?: (id: string) => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lookup = seriesLookup(board)
  const posts = feedOrder(boardPosts(board))

  const [hook, setHook] = useState<Hook>(
    story?.attachPostId ? "post" : story?.attachSeriesId ? "series" : "none",
  )
  const [postId, setPostId] = useState(story?.attachPostId ?? "")
  const [seriesId, setSeriesId] = useState(story?.attachSeriesId ?? "")
  const [role, setRole] = useState<StoryRole | null>(story?.role ?? null)
  const [onDate, setOnDate] = useState(story?.onDate ?? "")
  const [body, setBody] = useState(story?.body ?? "")
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const ready = body.trim().length > 0 && (hook !== "post" || Boolean(postId)) && (hook !== "series" || Boolean(seriesId))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    onSubmit({
      id: story?.id ?? crypto.randomUUID(),
      // Заполнено не больше одного: это проверяет и база.
      attachPostId: hook === "post" ? postId : null,
      attachSeriesId: hook === "series" ? seriesId : null,
      role,
      onDate: onDate || null,
      body: body.trim(),
    })
  }

  return (
    <dialog
      ref={dialog}
      onCancel={onCancel}
      onClick={e => {
        if (e.target === dialog.current) onCancel()
      }}
      className={DIALOG}
    >
      <form onSubmit={submit} className="grid max-h-[86dvh] gap-3.5 overflow-y-auto p-5">
        <div>
          <label className={LABEL} htmlFor="body">О чём выпуск</label>
          <textarea
            id="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Одна мысль — слайды соберутся в телефоне"
            rows={2}
            className={`${FIELD} resize-y`}
            autoFocus
            required
          />
        </div>

        <div>
          <span className={LABEL}>Привязка</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setHook("post")} aria-pressed={hook === "post"} className={CHOICE(hook === "post")}>
              Пост
            </button>
            <button type="button" onClick={() => setHook("series")} aria-pressed={hook === "series"} className={CHOICE(hook === "series")}>
              Серия
            </button>
            <button type="button" onClick={() => setHook("none")} aria-pressed={hook === "none"} className={CHOICE(hook === "none")}>
              Ничего
            </button>
          </div>

          {hook === "post" && (
            <select value={postId} onChange={e => setPostId(e.target.value)} className={`${FIELD} mt-2`}>
              <option value="">Выбери пост</option>
              {posts.map(p => (
                <option key={p.id} value={p.id}>{p.heading}</option>
              ))}
            </select>
          )}

          {hook === "series" && (
            <select value={seriesId} onChange={e => setSeriesId(e.target.value)} className={`${FIELD} mt-2`}>
              <option value="">Выбери серию</option>
              {lookup.roots.map(root => (
                <optgroup key={root.id} label={root.name}>
                  <option value={root.id}>{root.name} — вся серия</option>
                  {lookup.childrenOf(root.id).map(plot => (
                    <option key={plot.id} value={plot.id}>{plot.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>

        <div>
          <span className={LABEL}>Роль — необязательно</span>
          <div className="flex gap-1">
            {ROLES.map(r => (
              <button
                key={r.id}
                type="button"
                title={r.hint}
                onClick={() => setRole(role === r.id ? null : r.id)}
                aria-pressed={role === r.id}
                className={CHOICE(role === r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="story-day">День — необязательно</label>
          <input
            id="story-day"
            type="date"
            value={onDate}
            onChange={e => setOnDate(e.target.value)}
            className={FIELD}
          />
          <p className="mt-1 text-[11px] text-ink/45">
            Без своего дня сторис стоит по дню поста и роли
          </p>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button type="submit" disabled={!ready} className={PRIMARY}>
            {story ? "Сохранить" : "Добавить"}
          </button>
          <button type="button" onClick={onCancel} className={QUIET}>
            Отмена
          </button>

          {story && onDelete && (
            <span className="ml-auto flex items-center gap-2">
              {removing ? (
                <>
                  <span className="text-[11.5px] text-ink/70">Удалить насовсем?</span>
                  <button
                    type="button"
                    onClick={() => onDelete(story.id)}
                    className="rounded-[10px] bg-warn px-3 py-2 text-[12px] font-semibold text-on-fill"
                  >
                    Да
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(false)}
                    className="text-[12px] text-ink/45 underline underline-offset-2 hover:text-ink"
                  >
                    Нет
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setRemoving(true)}
                  title="Удалить сторис"
                  aria-label="Удалить сторис"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink/45 hover:bg-ink/[0.05] hover:text-warn"
                >
                  <Trash2 size={15} strokeWidth={1.9} />
                </button>
              )}
            </span>
          )}
        </div>
      </form>
    </dialog>
  )
}
