import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

/**
 * Перетаскивание внутри очереди.
 *
 * Правила записаны в «Движении» в `CLAUDE.md` и взяты из прототипа: один к
 * одному с указателем, порог перед началом жеста, живая перестановка с
 * доводкой через FLIP, одно ускорение без отскока.
 *
 * Двигать можно **только запланированное**: порядок есть лишь у очереди.
 * У вышедшего порядок задают дни, у идей его нет вовсе (ADR 0003).
 *
 * Смещение самой плитки ставится **прямо в стиль узла**, а не через состояние
 * React: на каждом движении указателя это был бы перерисованный экран, а
 * перерисовка нужна ровно тогда, когда меняется порядок.
 */

/** Пока палец не ушёл дальше — это нажатие, а не перенос. Иначе клик перестанет открывать пост. */
const THRESHOLD = 8

/** Одно ускорение, сильный ease-out. Ничего не бросают щелчком, поэтому без отскока. */
const SETTLE_MS = 300
const EASE = "cubic-bezier(.2, .9, .25, 1)"

const calm = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

type Snapshot = Map<string, DOMRect>

export type QueueDrag = {
  /** Порядок на экране сейчас: во время переноса он уже переставлен. */
  order: string[] | null
  /** Какую плитку несут. */
  carried: string | null
  register: (id: string, el: HTMLElement | null) => void
  onPointerDown: (e: React.PointerEvent, id: string) => void
  /** Был ли только что перенос — чтобы он не открыл карточку отпусканием. */
  justDragged: () => boolean
}

export function useQueueDrag(ids: string[], onDrop: (id: string, to: number) => void): QueueDrag {
  const [order, setOrder] = useState<string[] | null>(null)
  const [carried, setCarried] = useState<string | null>(null)

  // Карта узлов заводится лениво: отдать её в `useRef` готовой значило бы
  // передать хуку изменяемое значение, а их правило запрещает трогать потом.
  const box = useRef<Map<string, HTMLElement> | null>(null)
  const nodes = () => (box.current ??= new Map<string, HTMLElement>())

  const idsRef = useRef(ids)
  useEffect(() => {
    idsRef.current = ids
  }, [ids])

  const live = useRef<string[]>([])
  const from = useRef(0)
  const start = useRef({ x: 0, y: 0 })
  // Насколько уехало **место** под плиткой. Без этой поправки слежение рвётся
  // ровно в момент перестановки — тот самый просчёт, от которого жест скользит.
  const shift = useRef({ x: 0, y: 0 })
  const framed = useRef<Snapshot | null>(null)
  const dragging = useRef(false)
  const moved = useRef(false)

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodes().set(id, el)
    else nodes().delete(id)
  }, [])

  const snapshot = (): Snapshot => {
    const out: Snapshot = new Map()
    for (const [id, el] of nodes()) out.set(id, el.getBoundingClientRect())
    return out
  }

  /** Доводка сдвинутых плиток: каждая едет из прежнего прямоугольника в новый. */
  useLayoutEffect(() => {
    const was = framed.current
    framed.current = null
    if (!was || !order) return

    const quiet = calm()
    for (const [id, el] of nodes()) {
      const before = was.get(id)
      if (!before) continue
      const now = el.getBoundingClientRect()
      const dx = before.left - now.left
      const dy = before.top - now.top

      if (id === carried) {
        // Место под несомой плиткой прыгнуло — её начало отсчёта сдвигается
        // ровно на столько же, и палец остаётся в той же точке картинки.
        shift.current = { x: shift.current.x - dx, y: shift.current.y - dy }
        continue
      }
      if (!dx && !dy) continue

      el.style.transition = "none"
      el.style.transform = `translate(${dx}px, ${dy}px)`
      if (quiet) {
        el.style.transform = ""
        el.style.transition = ""
        continue
      }
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SETTLE_MS}ms ${EASE}`
        el.style.transform = ""
      })
    }
  }, [order, carried])

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    const el = nodes().get(id)
    if (!el) return

    moved.current = false
    dragging.current = false
    start.current = { x: e.clientX, y: e.clientY }
    shift.current = { x: 0, y: 0 }
    // Захват указателя нужен ради касания: без него браузер заберёт жест себе
    // на первом же движении. Но он не всегда разрешён, и слушатели всё равно
    // висят на окне — иначе отказ в захвате тихо отменял бы перенос целиком.
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Указателя уже нет или он чужой — переносу это не мешает.
    }

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.current.x
      const dy = ev.clientY - start.current.y

      if (!dragging.current) {
        if (Math.hypot(dx, dy) < THRESHOLD) return
        dragging.current = true
        moved.current = true
        live.current = [...idsRef.current]
        from.current = live.current.indexOf(id)
        el.style.transition = "none"
        el.style.zIndex = "3"
        el.style.cursor = "grabbing"
        document.body.style.userSelect = "none"
        setCarried(id)
        setOrder(live.current)
      }

      el.style.transform = `translate(${dx - shift.current.x}px, ${dy - shift.current.y}px)`

      // Куда он метит: ближайшая по центру плитка очереди. Сетка переносится,
      // поэтому считать надо по обеим осям, а не по одной горизонтали.
      let nearest = -1
      let best = Infinity
      live.current.forEach((other, i) => {
        const node = nodes().get(other)
        if (!node) return
        const r = node.getBoundingClientRect()
        const d = Math.hypot(r.left + r.width / 2 - ev.clientX, r.top + r.height / 2 - ev.clientY)
        if (d < best) {
          best = d
          nearest = i
        }
      })

      const at = live.current.indexOf(id)
      if (nearest >= 0 && nearest !== at) {
        framed.current = snapshot()
        const next = [...live.current]
        next.splice(at, 1)
        next.splice(nearest, 0, id)
        live.current = next
        setOrder(next)
      }
    }

    const done = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", done)
      window.removeEventListener("pointercancel", done)
      document.body.style.userSelect = ""
      el.style.zIndex = ""
      el.style.cursor = ""

      if (!dragging.current) return
      dragging.current = false

      const to = live.current.indexOf(id)
      // Доводка самой плитки: она едет в своё новое место, а не прыгает.
      if (calm()) {
        el.style.transition = ""
        el.style.transform = ""
      } else {
        el.style.transition = `transform ${SETTLE_MS}ms ${EASE}`
        el.style.transform = ""
        setTimeout(() => {
          el.style.transition = ""
        }, SETTLE_MS)
      }

      setCarried(null)
      setOrder(null)
      if (to !== from.current) onDrop(id, to)
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", done)
    window.addEventListener("pointercancel", done)
  }

  return { order, carried, register, onPointerDown, justDragged: () => moved.current }
}
