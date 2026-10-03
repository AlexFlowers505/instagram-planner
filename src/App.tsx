import { useEffect, useRef, useState } from "react"
import { useCloudAuth, signOut } from "./data/auth"
import { loadBoard } from "./data/load"
import { type QueueStatus, type SaveQueue, createSaveQueue } from "./data/queue"
import { CLOUD_ENABLED, PROJECT_REF } from "./data/supabase"
import { type Board, EMPTY_BOARD } from "./types/model"
import { AuthScreen } from "./views/AuthScreen"
import { LoadFailed, NoDatabase, SaveFailedBanner, SetPassword } from "./views/Screens"

/**
 * Оболочка: вход, загрузка, очередь записи и то, какой экран сейчас показан.
 * Доски здесь пока нет — она следующая.
 */

/**
 * Прочитанное хранится **вместе с тем, чьё оно**. Так доска одного
 * пользователя не может показаться другому даже на один кадр, а состояния
 * «грузится» и «не прочиталось» выводятся сравнением, а не сбрасываются
 * руками в эффекте.
 */
type LoadState =
  | { kind: "idle" }
  | { kind: "ok"; userId: string; board: Board }
  | { kind: "failed"; userId: string; error: string }

export default function App() {
  const { ready, session, recovery, clearRecovery } = useCloudAuth()
  const [load, setLoad] = useState<LoadState>({ kind: "idle" })
  const [saveStatus, setSaveStatus] = useState<QueueStatus>("idle")
  const [reloadAt, setReloadAt] = useState(0)

  /**
   * Ключ — **идентификатор пользователя, а не объект сессии**. GoTrue выдаёт
   * новый объект на каждое событие, и эффект, повешенный на него, в TimeLens
   * перечитывал все таблицы двенадцать раз за одну загрузку страницы.
   */
  const userId = session?.user.id ?? null

  const board = load.kind === "ok" && load.userId === userId ? load.board : EMPTY_BOARD
  const failure = load.kind === "failed" && load.userId === userId ? load.error : null
  const loading = Boolean(userId) && !failure && !(load.kind === "ok" && load.userId === userId)

  // Очередь читает доску в момент отправки, поэтому ей нужны свежие ссылки, а
  // не замыкания из первого рендера.
  const boardRef = useRef(board)
  const userRef = useRef(userId)
  useEffect(() => { boardRef.current = board }, [board])
  useEffect(() => { userRef.current = userId }, [userId])

  const queueRef = useRef<SaveQueue | null>(null)
  useEffect(() => {
    const q = createSaveQueue({
      getBoard: () => boardRef.current,
      getUserId: () => userRef.current,
      onStatus: setSaveStatus,
    })
    queueRef.current = q
    return () => {
      queueRef.current = null
      q.dispose()
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    loadBoard(userId)
      .then(next => { if (alive) setLoad({ kind: "ok", userId, board: next }) })
      .catch((err: unknown) => {
        if (alive) {
          setLoad({ kind: "failed", userId, error: err instanceof Error ? err.message : String(err) })
        }
      })
    return () => { alive = false }
  }, [userId, reloadAt])

  if (!CLOUD_ENABLED) return <NoDatabase />
  if (!ready) return null
  if (recovery) return <SetPassword onDone={clearRecovery} />
  if (!session) return <AuthScreen />
  if (failure) {
    return (
      <LoadFailed
        error={failure}
        onRetry={() => {
          setLoad({ kind: "idle" })
          setReloadAt(n => n + 1)
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[880px] px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-ed text-[17px] font-semibold tracking-[-0.018em]">Лента и серии</h1>
        <span className="text-[11.5px] text-ink/45">{session.user.email}</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="ml-auto rounded-lg bg-ink/[0.05] px-3 py-1.5 text-[12px] font-medium hover:bg-ink/10"
        >
          Выйти
        </button>
      </header>

      <p className="mt-8 text-[13px] text-ink/70">
        {loading
          ? "Читаю доску…"
          : `Прочитано: ${board.posts.length} постов, ${board.series.length} серий, ` +
            `${board.stories.length} сторис, ${board.highlights.length} актуальных.`}
      </p>
      <p className="mt-2 text-[12px] text-ink/45">
        Доска ещё не собрана — пока это только вход и слой данных. Образец видов
        и движения лежит в <code className="text-ink/70">prototype/feed-board.html</code>.
      </p>

      {import.meta.env.DEV && PROJECT_REF && (
        <p className="mt-6 text-[11px] text-ink/28">проект {PROJECT_REF}</p>
      )}

      {saveStatus === "failed" && <SaveFailedBanner />}
    </div>
  )
}
