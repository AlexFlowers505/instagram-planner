import { useEffect, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import type { Board, Highlight } from "../types/model"
import { seriesLookup } from "../lib/series"
import { CHOICE, DIALOG, FIELD, LABEL, PRIMARY, QUIET } from "../ui/form"

/**
 * Заведение и правка актуального.
 *
 * Актуальное — **своя сущность, а не серия** (ADR 0005): «Обо мне» серии не
 * имеет вовсе, «Еда» пересекает несколько. Поэтому ссылка на серию
 * необязательна, а набор сторис лежит внутри массивом.
 *
 * **Порядок массива — это порядок проигрывания**, поэтому отметка добавляет
 * сторис в конец, а не возвращает её на прежнее место.
 *
 * Флаг «собрано» хранит намерение: «надо собрать актуальное про Пекин, когда
 * серия закончится» — это тоже план, и теряться он не должен.
 */

export function HighlightForm({
  board,
  highlight,
  onSubmit,
  onDelete,
  onCancel,
}: {
  board: Board
  highlight?: Highlight
  onSubmit: (made: Highlight) => void
  onDelete?: (id: string) => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lookup = seriesLookup(board)

  const [name, setName] = useState(highlight?.name ?? "")
  const [seriesId, setSeriesId] = useState(highlight?.seriesId ?? "")
  const [assembled, setAssembled] = useState(highlight?.assembled ?? false)
  const [storyIds, setStoryIds] = useState<string[]>(highlight?.storyIds ?? [])
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const ready = name.trim().length > 0

  function toggle(id: string) {
    setStoryIds(was => (was.includes(id) ? was.filter(x => x !== id) : [...was, id]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    onSubmit({
      id: highlight?.id ?? crypto.randomUUID(),
      seriesId: seriesId || null,
      name: name.trim(),
      coverPath: highlight?.coverPath ?? null,
      assembled,
      storyIds,
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
          <label className={LABEL} htmlFor="hl-name">Имя кружка</label>
          <input
            id="hl-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Пекин, Еда, Обо мне"
            className={FIELD}
            autoFocus
            required
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="hl-series">Серия — необязательно</label>
          <select id="hl-series" value={seriesId} onChange={e => setSeriesId(e.target.value)} className={FIELD}>
            <option value="">Ни одной серии</option>
            {lookup.roots.map(root => (
              <option key={root.id} value={root.id}>{root.name}</option>
            ))}
          </select>
        </div>

        <div>
          <span className={LABEL}>Состояние</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setAssembled(false)} aria-pressed={!assembled} className={CHOICE(!assembled)}>
              Задумано
            </button>
            <button type="button" onClick={() => setAssembled(true)} aria-pressed={assembled} className={CHOICE(assembled)}>
              Собрано
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink/45">
            Задуманное — тоже план: «собрать, когда серия закончится»
          </p>
        </div>

        <div>
          <span className={LABEL}>
            Сторис внутри — {storyIds.length === 0 ? "ни одной" : `по порядку, ${storyIds.length}`}
          </span>
          {board.stories.length === 0 ? (
            <p className="text-[11.5px] text-ink/45">Сторис ещё нет — заведи хотя бы одну</p>
          ) : (
            <ul className="grid max-h-[180px] gap-px overflow-y-auto">
              {board.stories.map(s => {
                const at = storyIds.indexOf(s.id)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={at >= 0}
                      className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] ${
                        at >= 0 ? "bg-ink/[0.07]" : "hover:bg-ink/[0.05]"
                      }`}
                    >
                      <span className="w-4 shrink-0 text-[10.5px] tabular-nums text-ink/45">
                        {at >= 0 ? at + 1 : ""}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{s.body || "без текста"}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button type="submit" disabled={!ready} className={PRIMARY}>
            {highlight ? "Сохранить" : "Добавить"}
          </button>
          <button type="button" onClick={onCancel} className={QUIET}>
            Отмена
          </button>

          {highlight && onDelete && (
            <span className="ml-auto flex items-center gap-2">
              {removing ? (
                <>
                  <span className="text-[11.5px] text-ink/70">Удалить насовсем?</span>
                  <button
                    type="button"
                    onClick={() => onDelete(highlight.id)}
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
                  title="Удалить актуальное"
                  aria-label="Удалить актуальное"
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
