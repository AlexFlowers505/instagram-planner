import { useEffect, useRef, useState } from "react"
import { useCloudAuth, signOut } from "./data/auth"
import { loadBoard } from "./data/load"
import { type WriteOp, opDelete, opUpsert } from "./data/ops"
import { type QueueStatus, type SaveQueue, createSaveQueue } from "./data/queue"
import { CLOUD_ENABLED, PROJECT_REF } from "./data/supabase"
import { DEMO_BOARD, DEMO_TODAY } from "./data/demoBoard"
import { todayKey } from "./lib/date"
import { boardPosts, queue } from "./lib/feed"
import { freshRanks, rankForMove } from "./lib/rank"
import { type Board, EMPTY_BOARD } from "./types/model"
import { AuthScreen } from "./views/AuthScreen"
import { Feed } from "./views/Feed"
import { type Submitted, PostForm } from "./views/PostForm"
import { LoadFailed, NoDatabase, SaveFailedBanner, SetPassword } from "./views/Screens"
import { SelfCheckPanel } from "./views/SelfCheckPanel"

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
/**
 * Что открыто в форме. Одно состояние вместо пары «добавляем» и «правим»:
 * открыты они не бывают одновременно, а два флага это допускали бы.
 */
type Editor = { kind: "new" } | { kind: "post"; id: string }

type LoadState =
  | { kind: "idle" }
  | { kind: "ok"; userId: string; board: Board }
  | { kind: "failed"; userId: string; error: string }

/**
 * Образец данных для работы над видом: `?demo=1` в режиме разработки. Нужен
 * затем, что проверять разметку на настоящих данных владельца незачем, а в
 * панели предпросмотра нет его сессии.
 */
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has("demo")

/**
 * Песочница на образце данных: всё работает, но живёт только в памяти.
 * Добавленное здесь исчезает при перезагрузке, и это правильно — иначе образец
 * перестал бы быть образцом.
 */
function DemoApp() {
  const [board, setBoard] = useState<Board>(DEMO_BOARD)
  const [editor, setEditor] = useState<Editor | null>(null)

  const editing =
    editor?.kind === "post" ? board.posts.find(p => p.id === editor.id) : undefined

  return (
    <div className="mx-auto max-w-[880px] px-4 py-6">
      <p className="mb-4 text-[11.5px] text-ink/45">
        Образец данных — настоящая доска не читается и не пишется
      </p>
      <Feed
        board={board}
        today={DEMO_TODAY}
        onOpen={id => setEditor({ kind: "post", id })}
        onAdd={() => setEditor({ kind: "new" })}
        onMove={(id, to) => setBoard(b => withMove(b, id, to)?.board ?? b)}
      />
      {editor && (
        <PostForm
          key={editor.kind === "post" ? editor.id : "new"}
          board={board}
          post={editing}
          onCancel={() => setEditor(null)}
          onSubmit={({ post, series }) => {
            setBoard(b => ({
              ...b,
              series: series ? [...b.series, series] : b.series,
              posts: b.posts.some(x => x.id === post.id)
                ? b.posts.map(x => (x.id === post.id ? post : x))
                : [...b.posts, post],
            }))
            setEditor(null)
          }}
          onDelete={id => {
            setBoard(b => withoutPost(b, id))
            setEditor(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Доска после переноса в очереди и **список тронутых строк**.
 *
 * Обычно строка одна — та, которую несли: в этом и смысл дробного ранга
 * (ADR 0002). Если зазор между соседями исчерпан, очередь перенумеровывается
 * целиком; это единственное место, где запись трогает много строк сразу, и
 * случается оно примерно раз в тысячу переносов в одно и то же место.
 */
function withMove(board: Board, id: string, to: number): { board: Board; touched: string[] } | null {
  const q = queue(boardPosts(board))
  const from = q.findIndex(p => p.id === id)
  if (from < 0 || to < 0 || to >= q.length || from === to) return null

  const rank = rankForMove(
    q.map(p => p.rank ?? 0),
    from,
    to,
  )

  if (rank !== null) {
    return {
      board: { ...board, posts: board.posts.map(p => (p.id === id ? { ...p, rank } : p)) },
      touched: [id],
    }
  }

  const next = [...q]
  next.splice(from, 1)
  next.splice(to, 0, q[from])
  const fresh = freshRanks(next.length)
  const ranked = new Map(next.map((p, i) => [p.id, fresh[i]]))
  return {
    board: {
      ...board,
      posts: board.posts.map(p => {
        const r = ranked.get(p.id)
        return r === undefined ? p : { ...p, rank: r }
      }),
    },
    touched: next.map(p => p.id),
  }
}

/**
 * Доска без поста — и без того, что на нём держалось: его сторис, а их — из
 * актуального. На сервере это делают `on delete cascade` и триггер
 * `highlights_forget_story()`, поэтому в очередь уходит одна операция. Здесь
 * то же самое повторяется в памяти: иначе до перезагрузки доска показывала бы
 * сторис удалённого поста и актуальное со ссылками в пустоту.
 */
function withoutPost(board: Board, id: string): Board {
  const orphans = new Set(board.stories.filter(s => s.attachPostId === id).map(s => s.id))
  return {
    ...board,
    posts: board.posts.filter(p => p.id !== id),
    stories: board.stories.filter(s => !orphans.has(s.id)),
    highlights: board.highlights.map(h =>
      h.storyIds.some(sid => orphans.has(sid))
        ? { ...h, storyIds: h.storyIds.filter(sid => !orphans.has(sid)) }
        : h,
    ),
  }
}

export default function App() {
  const { ready, session, recovery, clearRecovery } = useCloudAuth()
  const [load, setLoad] = useState<LoadState>({ kind: "idle" })
  const [saveStatus, setSaveStatus] = useState<QueueStatus>("idle")
  const [reloadAt, setReloadAt] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null)

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

  /** Единственный путь к записи: новое состояние плюс то, какие строки тронуты. */
  function persist(next: Board, ...ops: WriteOp[]) {
    if (!userId) return
    setLoad({ kind: "ok", userId, board: next })
    boardRef.current = next
    queueRef.current?.push(...ops)
  }

  /** Заведение и правка — один путь: отличает их только то, есть ли уже строка. */
  function savePost({ post, series }: Submitted) {
    // Серия уходит первой: пост на неё ссылается внешним ключом, а очередь
    // применяет операции в том порядке, в каком они пришли.
    const ops = series
      ? [opUpsert("series", series.id), opUpsert("post", post.id)]
      : [opUpsert("post", post.id)]

    const known = board.posts.some(p => p.id === post.id)

    persist(
      {
        ...board,
        series: series ? [...board.series, series] : board.series,
        posts: known
          ? board.posts.map(p => (p.id === post.id ? post : p))
          : [...board.posts, post],
      },
      ...ops,
    )
    setEditor(null)
  }

  /** Перенос в очереди: ранг меняется у того, кого несли, и больше ни у кого. */
  function movePost(id: string, to: number) {
    const done = withMove(board, id, to)
    if (!done) return
    persist(done.board, ...done.touched.map(x => opUpsert("post", x)))
  }

  /** Одна операция удаления: остальное на сервере делают каскад и триггер. */
  function deletePost(id: string) {
    persist(withoutPost(board, id), opDelete("post", id))
    setEditor(null)
  }

  if (DEMO) return <DemoApp />

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

      {loading ? (
        <p className="mt-8 text-[13px] text-ink/70">Читаю доску…</p>
      ) : (
        <Feed
          board={board}
          today={todayKey()}
          onOpen={id => setEditor({ kind: "post", id })}
          onAdd={() => setEditor({ kind: "new" })}
          onMove={movePost}
        />
      )}

      {editor && (
        <PostForm
          key={editor.kind === "post" ? editor.id : "new"}
          board={board}
          post={editor.kind === "post" ? board.posts.find(p => p.id === editor.id) : undefined}
          onSubmit={savePost}
          onDelete={deletePost}
          onCancel={() => setEditor(null)}
        />
      )}

      {import.meta.env.DEV && PROJECT_REF && (
        <p className="mt-6 text-[11px] text-ink/28">проект {PROJECT_REF}</p>
      )}

      {import.meta.env.DEV && <SelfCheckPanel userId={session.user.id} />}

      {saveStatus === "failed" && <SaveFailedBanner />}
    </div>
  )
}
