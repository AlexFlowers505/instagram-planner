import { useState } from "react"
import { requestPasswordReset, signIn } from "../data/auth"

/**
 * Вход. Формы регистрации здесь нет и не будет, пока доска — задел: аккаунты
 * заводятся руками в консоли (ADR 0001). Ссылка «забыл пароль» есть, но
 * предупреждает про лимит писем, чтобы молчание почты не выглядело поломкой.
 */

const FIELD =
  "w-full rounded-[10px] bg-ink/[0.05] px-3 py-2.5 text-ink outline-none " +
  "placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-ink/45"

export function AuthScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    if (!email.trim()) {
      setError("Сначала введи почту — на неё придёт ссылка")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-[320px]">
        <h1 className="font-ed text-[22px] font-semibold tracking-[-0.02em]">Лента и серии</h1>
        <p className="mt-1 mb-6 text-[12.5px] text-ink/45">Доска состава контента</p>

        <label className="mb-1.5 block text-[11px] font-medium tracking-[0.06em] text-ink/45 uppercase">
          Почта
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={FIELD}
          required
        />

        <label className="mt-4 mb-1.5 block text-[11px] font-medium tracking-[0.06em] text-ink/45 uppercase">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={FIELD}
          required
        />

        {error && (
          <p className="mt-4 text-[12.5px] text-warn" role="alert">
            {error}
          </p>
        )}
        {sent && (
          <p className="mt-4 text-[12.5px] text-ink/70">
            Письмо отправлено. Встроенная почта отдаёт два письма в час — если не
            пришло, подожди, а не шли ещё раз.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-[10px] bg-ink px-3 py-2.5 text-[13px] font-semibold text-on-fill transition-opacity disabled:opacity-50"
        >
          {busy ? "Минуту…" : "Войти"}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          className="mt-3 w-full text-[12px] text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          Забыл пароль
        </button>
      </form>
    </div>
  )
}
