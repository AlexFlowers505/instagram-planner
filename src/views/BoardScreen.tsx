import { useState } from "react"
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

type Props = {
  board: Board
  today: string
  onOpen: (id: string) => void
  onAdd?: () => void
  onMove?: (id: string, to: number) => void
  covers?: Map<string, string>
}

export function BoardScreen({ board, today, onOpen, onAdd, onMove, covers }: Props) {
  const [view, setView] = useState<View>("grid")

  return (
    <>
      <nav className="mt-4 flex gap-0.5 rounded-full bg-ink/[0.05] p-0.5 justify-self-start">
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

      {view === "grid" && (
        <Feed
          board={board}
          today={today}
          onOpen={onOpen}
          onAdd={onAdd}
          onMove={onMove}
          covers={covers}
        />
      )}
      {view === "series" && <SeriesView board={board} onOpen={onOpen} />}
      {view === "due" && <DueView board={board} today={today} onOpen={onOpen} />}
    </>
  )
}
