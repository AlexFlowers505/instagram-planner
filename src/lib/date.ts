/**
 * Ключи дат и их чтение вслух.
 *
 * Всё по местному времени: `toISOString().slice(0, 10)` сдвигает день на
 * единицу для всех восточнее Гринвича, и это ошибка, которую не видно, пока
 * кто-нибудь не окажется в другом часовом поясе.
 */

const MONTHS = ["янв.", "февр.", "мар.", "апр.", "мая", "июня", "июля",
                "авг.", "сент.", "окт.", "нояб.", "дек."]

const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль",
                    "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]

export const parseKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const todayKey = () => toKey(new Date())

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function mondayOf(key: string): string {
  const d = parseKey(key)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toKey(d)
}

export const daysBetween = (a: string, b: string) =>
  Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000)

/** «12 сент.» Пустой ключ даёт пустую строку, а не «Invalid Date». */
export function fmtDay(key: string | null): string {
  if (!key) return ""
  const d = parseKey(key)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const monthName = (key: string) => MONTHS_NOM[parseKey(key).getMonth()]

/**
 * Три формы, как в русском: 1/21/31 — первая, 2–4 и 22–24 — вторая, 11–14 и
 * остальные — третья. Ошибка здесь — самый громкий признак машинного перевода.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const m100 = n % 100
  const m10 = n % 10
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
