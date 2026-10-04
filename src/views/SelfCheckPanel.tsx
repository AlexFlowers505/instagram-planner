import { useState } from "react"
import { type CheckResult, runSelfCheck } from "../data/selfCheck"

/**
 * Временная панель: прогоняет проверку слоя данных против живой базы под
 * текущим аккаунтом. Видна только в режиме разработки и **удаляется вместе с
 * `data/selfCheck.ts`**, когда доска начнёт писать по-настоящему.
 */
export function SelfCheckPanel({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [crashed, setCrashed] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setCrashed(null)
    setResults(null)
    try {
      setResults(await runSelfCheck(userId))
    } catch (e) {
      setCrashed(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const failed = results?.filter(r => !r.ok).length ?? 0

  return (
    <section className="mt-10 border-t border-ink/10 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-ed text-[15px] font-semibold tracking-[-0.01em]">Проверка слоя данных</h2>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-on-fill disabled:opacity-50"
        >
          {busy ? "Идёт…" : "Прогнать"}
        </button>
        {results && (
          <span className={`text-[12px] ${failed ? "text-warn" : "text-ink/45"}`}>
            {failed ? `не прошло: ${failed} из ${results.length}` : `всё прошло: ${results.length}`}
          </span>
        )}
      </div>

      <p className="mt-2 max-w-[60ch] text-[12px] text-ink/45">
        Заводит свои строки, проверяет триггеры и ограничения схемы и удаляет их
        за собой. Чужого не трогает. Временная — уйдёт вместе с пунктом 2.
      </p>

      {crashed && (
        <p className="mt-3 text-[12.5px] text-warn" role="alert">
          {crashed}
        </p>
      )}

      {results && (
        <ul className="mt-4 grid gap-1.5">
          {results.map(r => (
            <li key={r.name} className="grid grid-cols-[14px_1fr] gap-2.5 text-[12.5px]">
              <span className={r.ok ? "text-ink/45" : "text-warn"}>{r.ok ? "✓" : "✗"}</span>
              <span>
                <span className={r.ok ? "text-ink" : "text-warn"}>{r.name}</span>
                <span className="block text-[11.5px] text-ink/45">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
