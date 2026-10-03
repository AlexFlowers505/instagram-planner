import type { Board } from "../types/model"
import { type WriteOp, applyWriteOp, collapse } from "./ops"

/**
 * Очередь записи: собирает операции, отправляет их пачкой с задержкой и не даёт
 * потерять ни одну.
 *
 * Три правила, каждое из которых в TimeLens появилось после того, как без него
 * что-то сломалось:
 *
 * 1. **Неудачная запись должна быть видна.** Ошибку нельзя записать в консоль и
 *    пойти дальше: операции возвращаются в очередь, статус становится `failed`,
 *    и интерфейс обязан это показать.
 * 2. **Операции идемпотентны** — это upsert по id, — поэтому повтор безвреден.
 * 3. **Содержимое берётся в момент отправки.** Очередь хранит только то, какие
 *    строки тронуты.
 */

export type QueueStatus = "idle" | "pending" | "saving" | "failed"

export type SaveQueue = {
  push: (...ops: WriteOp[]) => void
  flush: () => Promise<void>
  dispose: () => void
}

type Options = {
  getBoard: () => Board
  getUserId: () => string | null
  onStatus?: (status: QueueStatus) => void
  debounceMs?: number
  retryMs?: number
}

export function createSaveQueue(opts: Options): SaveQueue {
  const debounceMs = opts.debounceMs ?? 1000
  const retryMs = opts.retryMs ?? 5000

  let pending: WriteOp[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let sending = false
  let disposed = false

  const setStatus = (s: QueueStatus) => opts.onStatus?.(s)

  function schedule(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, ms)
  }

  function push(...ops: WriteOp[]) {
    if (disposed || ops.length === 0) return
    pending.push(...ops)
    setStatus("pending")
    schedule(debounceMs)
  }

  async function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null }
    if (retry) { clearTimeout(retry); retry = null }
    if (sending || pending.length === 0) return

    const userId = opts.getUserId()
    // Без пользователя писать некуда, но и терять нечего: операции ждут.
    if (!userId) return

    const batch = collapse(pending)
    pending = []
    sending = true
    setStatus("saving")

    try {
      const board = opts.getBoard()
      for (const op of batch) await applyWriteOp(board, userId, op)
      setStatus(pending.length ? "pending" : "idle")
    } catch {
      // Назад в очередь, перед теми, что пришли, пока мы отправляли: порядок
      // внутри строки сохраняется, а схлопывание всё равно оставит последнее.
      pending = [...batch, ...pending]
      setStatus("failed")
      retry = setTimeout(() => { void flush() }, retryMs)
    } finally {
      sending = false
    }
  }

  /** Вкладку закрывают или прячут — отправляем, не дожидаясь задержки. */
  const onHide = () => { if (document.visibilityState === "hidden") void flush() }
  const onPageHide = () => { void flush() }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHide)
    addEventListener("pagehide", onPageHide)
  }

  function dispose() {
    disposed = true
    if (timer) clearTimeout(timer)
    if (retry) clearTimeout(retry)
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onHide)
      removeEventListener("pagehide", onPageHide)
    }
    void flush()
  }

  return { push, flush, dispose }
}
