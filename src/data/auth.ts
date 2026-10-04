import type { Session } from "@supabase/supabase-js"
import { useCallback, useEffect, useState } from "react"
import { CLOUD_ENABLED, DataError, supabase } from "./supabase"

/**
 * Вход и регистрация. Регистрация открыта, подтверждение почты включено,
 * письма идут через свой SMTP — [ADR 0006], который отменил эту часть 0001.
 */

export type CloudAuth = {
  /** Ответ про вход получен. До этого показывать нечего — ни журнал, ни форму. */
  ready: boolean
  session: Session | null
  /** Пришли по ссылке восстановления пароля. */
  recovery: boolean
}

export function useCloudAuth(): CloudAuth & { clearRecovery: () => void } {
  const [state, setState] = useState<CloudAuth>({
    ready: !CLOUD_ENABLED,
    session: null,
    recovery: false,
  })

  useEffect(() => {
    if (!supabase) return
    let alive = true

    /**
     * **Подписка раньше вопроса.** `ready` поднимается на `INITIAL_SESSION`, а
     * не когда ответит `getSession()`. Обратный порядок оставляет щель:
     * сохранённый токен, которому нужно обновление, отвечает «никого», мы
     * решаем, что пользователь не вошёл, и форма входа мигает на всё время
     * обновления.
     */
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      setState(s => ({
        ready: true,
        session,
        recovery: event === "PASSWORD_RECOVERY" ? true : s.recovery,
      }))
    })

    // Страховка: если событие почему-то не придёт, пустой экран навсегда хуже,
    // чем форма входа через четыре секунды.
    const safety = setTimeout(() => {
      if (alive) setState(s => (s.ready ? s : { ...s, ready: true }))
    }, 4000)

    return () => {
      alive = false
      clearTimeout(safety)
      sub.subscription.unsubscribe()
    }
  }, [])

  const clearRecovery = useCallback(() => setState(s => ({ ...s, recovery: false })), [])

  return { ...state, clearRecovery }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new DataError("signIn", "База не настроена")
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new DataError("signIn", error.message, error)
}

/**
 * Регистрация. При включённом подтверждении сессии сразу не будет: Supabase
 * заводит пользователя и ждёт, пока он перейдёт по ссылке из письма.
 *
 * **Про занятый адрес здесь молчат намеренно.** Supabase отвечает одинаково,
 * занят он или нет, — иначе форма регистрации становится способом проверять,
 * есть ли у человека тут аккаунт. Поэтому и экран дальше один и тот же.
 */
export async function signUp(email: string, password: string): Promise<void> {
  if (!supabase) throw new DataError("signUp", "База не настроена")
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin },
  })
  if (error) throw new DataError("signUp", error.message, error)
}

/** Отправить письмо подтверждения заново. */
export async function resendConfirmation(email: string): Promise<void> {
  if (!supabase) throw new DataError("resendConfirmation", "База не настроена")
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: location.origin },
  })
  if (error) throw new DataError("resendConfirmation", error.message, error)
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new DataError("signOut", error.message, error)
}

/**
 * Сброс пароля. Как и подтверждение, идёт через свой SMTP: лимит после его
 * подключения — 30 писем в час, см. ADR 0006.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new DataError("requestPasswordReset", "База не настроена")
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin,
  })
  if (error) throw new DataError("requestPasswordReset", error.message, error)
}

export async function setPassword(password: string): Promise<void> {
  if (!supabase) throw new DataError("setPassword", "База не настроена")
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new DataError("setPassword", error.message, error)
}
