import { useEffect, useState } from "react"
import { requestPasswordReset, resendConfirmation, signIn, signUp } from "../data/auth"

/**
 * Вход и регистрация (ADR 0006). Подтверждение почты включено, поэтому после
 * регистрации сессии нет — есть экран «проверь почту».
 */

const FIELD =
  "w-full rounded-[10px] bg-ink/[0.05] px-3 py-2.5 text-ink outline-none " +
  "placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-ink/45"

const LABEL = "mb-1.5 block text-[11px] font-medium tracking-[0.06em] text-ink/45 uppercase"

/** Придержать повтор на минуту: лимит писем 30 в час, и сжечь его двойным
 *  нажатием не должно быть возможно. */
const RESEND_COOLDOWN = 60

type Mode = "in" | "up" | "sent"

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNote(null)
    if (mode === "up") {
      void run(() => signUp(email.trim(), password), () => {
        setMode("sent")
        setCooldown(RESEND_COOLDOWN)
      })
    } else {
      void run(() => signIn(email.trim(), password))
    }
  }

  if (mode === "sent") {
    return (
      <Shell>
        <h1 className="font-ed text-[22px] font-semibold tracking-[-0.02em]">Проверь почту</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
          Отправили письмо на <span className="text-ink">{email.trim()}</span>. Перейди
          по ссылке из него — после этого доска откроется сама.
        </p>
        <p className="mt-3 text-[12px] text-ink/45">
          Письма нет? Загляни в спам. Если адрес уже заведён, нового письма не
          будет — попробуй войти.
        </p>

        {error && (
          <p className="mt-4 text-[12.5px] text-warn" role="alert">
            {error}
          </p>
        )}
        {note && <p className="mt-4 text-[12.5px] text-ink/70">{note}</p>}

        <button
          type="button"
          disabled={busy || cooldown > 0}
          onClick={() =>
            void run(() => resendConfirmation(email.trim()), () => {
              setNote("Отправили ещё раз")
              setCooldown(RESEND_COOLDOWN)
            })
          }
          className="mt-5 w-full rounded-[10px] bg-ink/[0.05] px-3 py-2.5 text-[13px] font-medium hover:bg-ink/10 disabled:opacity-50"
        >
          {cooldown > 0 ? `Отправить снова можно через ${cooldown} с` : "Отправить письмо снова"}
        </button>

        <button
          type="button"
          onClick={() => { setMode("in"); setError(null); setNote(null) }}
          className="mt-3 w-full text-[12px] text-ink/45 underline underline-offset-2 hover:text-ink"
        >
          Вернуться ко входу
        </button>
      </Shell>
    )
  }

  const signingUp = mode === "up"

  return (
    <Shell>
      <form onSubmit={onSubmit}>
        <h1 className="font-ed text-[22px] font-semibold tracking-[-0.02em]">Лента и серии</h1>
        <p className="mt-1 mb-6 text-[12.5px] text-ink/45">Доска состава контента</p>

        <label className={LABEL} htmlFor="email">Почта</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={FIELD}
          required
        />

        <label className={`${LABEL} mt-4`} htmlFor="password">Пароль</label>
        <input
          id="password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          value={password}
          onChange={e => setPassword(e.target.value)}
          minLength={signingUp ? 8 : undefined}
          className={FIELD}
          required
        />
        {signingUp && <p className="mt-1.5 text-[11.5px] text-ink/45">Не короче восьми знаков</p>}

        {error && (
          <p className="mt-4 text-[12.5px] text-warn" role="alert">
            {error}
          </p>
        )}
        {note && <p className="mt-4 text-[12.5px] text-ink/70">{note}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-[10px] bg-ink px-3 py-2.5 text-[13px] font-semibold text-on-fill disabled:opacity-50"
        >
          {busy ? "Минуту…" : signingUp ? "Зарегистрироваться" : "Войти"}
        </button>

        <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
          <button
            type="button"
            onClick={() => { setMode(signingUp ? "in" : "up"); setError(null); setNote(null) }}
            className="text-ink/70 underline underline-offset-2 hover:text-ink"
          >
            {signingUp ? "У меня уже есть аккаунт" : "Зарегистрироваться"}
          </button>

          {!signingUp && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!email.trim()) { setError("Сначала введи почту — на неё придёт ссылка"); return }
                void run(() => requestPasswordReset(email.trim()), () =>
                  setNote("Письмо для смены пароля отправлено"))
              }}
              className="text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              Забыл пароль
            </button>
          )}
        </div>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-[320px]">{children}</div>
    </div>
  )
}
