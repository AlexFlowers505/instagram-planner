import { useState } from "react"
import { Plus } from "lucide-react"
import type { Board } from "../types/model"
import { Feed } from "./Feed"
import { SeriesView } from "./SeriesView"
import { DueView } from "./DueView"

/**
 * Три вида и переключатель между ними.
 *
 * Видов три, потому что доска отвечает на три разных вопроса: хорошо ли посты
 * стоят рядом, разворачивается ли замысел, нет ли дырок во времени. Вид,
 * который берётся отвечать на всё, не отвечает ни на что — поэтому каждый
 * держится своего, и состояние у них общее только одно: какой открыт.
 */

type View = "grid" | "series" | "due"

const TABS: Array<{ id: View; label: string; hint: string }> = [
  { id: "grid", label: "Сетка", hint: "Хорошо ли посты стоят рядом" },
  { id: "series", label: "Серии", hint: "Разворачивается ли замысел" },
  { id: "due", label: "Срок", hint: "Нет ли дырок во времени и насколько вперёд набрано" },
]

/** Что открыть в форме. Без `id` — завести новое. */
export type Edit = { kind: "post" | "story" | "highlight"; id?: string }

type Props = {
  board: Board
  today: string
  /** Отсутствует там, где писать нельзя. Кнопок тогда нет, а не отключены. */
  onEdit?: (what: Edit) => void
  onMove?: (id: string, to: number) => void
  covers?: Map<string, string>
}

const ADD: Array<{ kind: Edit["kind"]; label: string }> = [
  { kind: "post", label: "Пост" },
  { kind: "story", label: "Сторис" },
  { kind: "highlight", label: "Актуальное" },
]

export function BoardScreen({ board, today, onEdit, onMove, covers }: Props) {
  const [view, setView] = useState<View>("grid")
  const open = (what: Edit) => onEdit?.(what)

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
      <nav className="flex gap-0.5 rounded-full bg-ink/[0.05] p-0.5">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            aria-pressed={view === t.id}
            title={t.hint}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              view === t.id ? "bg-surface text-ink shadow-sm" : "text-ink/70 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Заводить можно из любого вида: мысль «надо сторис» приходит не только
          там, где сторис видно. */}
      {onEdit && (
        <span className="ml-auto flex gap-1.5">
          {ADD.map(a => (
            <button
              key={a.kind}
              type="button"
              onClick={() => open({ kind: a.kind })}
              className="flex items-center gap-1 rounded-lg bg-ink/[0.05] px-2.5 py-1.5 text-[12px] font-medium hover:bg-ink/10"
            >
              <Plus size={13} strokeWidth={2.2} />
              {a.label}
            </button>
          ))}
        </span>
      )}
      </div>

      {view === "grid" && (
        <Feed
          board={board}
          today={today}
          onOpen={id => open({ kind: "post", id })}
          onMove={onMove}
          covers={covers}
        />
      )}
      {view === "series" && (
        <SeriesView
          board={board}
          onOpen={id => open({ kind: "post", id })}
          onEditStory={onEdit ? id => open({ kind: "story", id }) : undefined}
          onEditHighlight={onEdit ? id => open({ kind: "highlight", id }) : undefined}
        />
      )}
      {view === "due" && (
        <DueView
          board={board}
          today={today}
          onOpen={id => open({ kind: "post", id })}
          onEditStory={onEdit ? id => open({ kind: "story", id }) : undefined}
        />
      )}
    </>
  )
}
