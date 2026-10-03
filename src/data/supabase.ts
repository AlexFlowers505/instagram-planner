import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Единственное место, которое знает адрес проекта.
 *
 * Запасного значения нет намеренно: пустые переменные дают экран «база не
 * настроена», а не тихое подключение куда-то ещё. В TimeLens это правило
 * появилось после того, как одна забытая переменная могла увести правки в
 * настоящий журнал.
 */

const url = import.meta.env.VITE_SUPABASE_URL ?? ""
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""

export const CLOUD_ENABLED = Boolean(url && key)

/** Ссылка на проект, для отметки в углу на localhost. */
export const PROJECT_REF = url.replace(/^https:\/\//, "").split(".")[0] || ""

/** Postgrest отдаёт не больше тысячи строк за раз. */
export const PAGE_SIZE = 1000

/**
 * Клиент импортируется сразу, а не лениво. В TimeLens он ленивый, потому что
 * там есть выход без входа; здесь без базы делать нечего, и отложенная
 * загрузка купила бы только лишнюю асинхронность на каждом вызове.
 */
export const supabase: SupabaseClient | null = CLOUD_ENABLED
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

/** Ошибка от Supabase, поднятая до исключения. */
export class DataError extends Error {
  readonly where: string
  readonly cause?: unknown
  constructor(where: string, message: string, cause?: unknown) {
    super(`${where}: ${message}`)
    this.name = "DataError"
    this.where = where
    this.cause = cause
  }
}

/**
 * supabase-js **возвращает ошибку в ответе, а не бросает её**. Каждый вызов
 * обязан проверить `{ error }`; в TimeLens пропущенная проверка молча стоила
 * полутора суток правок. Эта функция делает проверку одной строкой, чтобы её
 * не забывали.
 *
 * Берёт `unknown` намеренно. Без сгенерированных типов базы supabase-js не
 * может вывести форму ответа на `select` с динамической строкой колонок и
 * подставляет `GenericStringError[]`. Приведение всё равно нужно — и лучше
 * одно здесь, чем по одному на каждом вызове. Когда понадобится настоящая
 * типизация строк, её даст `supabase gen types typescript`, и тогда отсюда
 * уйдёт и этот комментарий.
 */
export function unwrap<T>(where: string, res: unknown): T {
  const r = res as { data: T; error: { message: string } | null }
  if (r.error) throw new DataError(where, r.error.message, r.error)
  return r.data
}

/** Клиент или внятная ошибка вместо `null!`. */
export function client(): SupabaseClient {
  if (!supabase) throw new DataError("client", "База не настроена: нет VITE_SUPABASE_URL или ключа")
  return supabase
}
