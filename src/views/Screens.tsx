import { useState } from "react"
import { setPassword } from "../data/auth"

/** Простые экраны, на которых приложение останавливается. */

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center px-4">
      <div className="w-full max-w-[360px]">
        <h1 className="font-ed text-[20px] font-semibold tracking-[-0.02em]">{title}</h1>
        <div className="mt-2 text-[13px] leading-relaxed text-ink/70">{children}</div>
      </div>
    </div>
  )
}

export function NoDatabase() {
  return (
    <Shell title="База не настроена">
      Нет <code className="text-ink">VITE_SUPABASE_URL</code> или{" "}
      <code className="text-ink">VITE_SUPABASE_PUBLISHABLE_KEY</code>. Подставь адрес
      проекта и публикуемый ключ в{" "}
      <code className="text-ink">
        {import.meta.env.DEV ? ".env.development.local" : ".env.production"}
      </code>{" "}
      — образец рядом, в <code className="text-ink">.env.example</code>.
      {!import.meta.env.DEV && (
        <p className="mt-3">
          Переменные вшиваются в сборку, а не читаются на ходу: после правки нужна
          пересборка.
        </p>
      )}
      <p className="mt-3 text-ink/45">
        Запасного адреса нет намеренно: иначе одна забытая переменная уводила бы
        правки не туда.
      </p>
    </Shell>
  )
}

/**
 * Неудачное чтение — это **не пустой аккаунт**. Поэтому здесь тупик: ничего не
 * показываем и ничего не пишем. В TimeLens противоположное поведение однажды
 * дало автосохранению затереть настоящие данные пустыми.
 */
export function LoadFailed({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Shell title="Не удалось прочитать доску">
      Данные не загрузились, поэтому доска не открыта и <b className="text-ink">ничего не
      сохраняется</b> — иначе пустой экран мог бы затереть то, что есть на сервере.
      <pre className="mt-3 overflow-x-auto rounded-lg bg-ink/[0.05] p-3 text-[11.5px] whitespace-pre-wrap text-ink/70">
        {error}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-[10px] bg-ink px-3.5 py-2 text-[13px] font-semibold text-on-fill"
      >
        Попробовать ещё раз
      </button>
    </Shell>
  )
}

/** Пришли по ссылке восстановления: сессия уже есть, нужен новый пароль. */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await setPassword(value)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Новый пароль">
      <form onSubmit={submit}>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={e => setValue(e.target.value)}
          minLength={8}
          required
          className="mt-2 w-full rounded-[10px] bg-ink/[0.05] px-3 py-2.5 text-ink outline-none focus-visible:outline-2 focus-visible:outline-ink/45"
        />
        {error && (
          <p className="mt-3 text-[12.5px] text-warn" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-[10px] bg-ink px-3 py-2.5 text-[13px] font-semibold text-on-fill disabled:opacity-50"
        >
          Сохранить
        </button>
      </form>
    </Shell>
  )
}

/** Запись не прошла. Молча проглотить её нельзя — см. ADR 0002 и очередь. */
export function SaveFailedBanner() {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 bg-warn px-4 py-2 text-center text-[12.5px] text-on-fill"
    >
      Изменения не сохраняются. Повтор идёт автоматически — не закрывай вкладку.
    </div>
  )
}
