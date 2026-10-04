import { client, unwrap } from "./supabase"

/**
 * Обложки. Ведро закрытое (миграция 002), поэтому наружу они ходят только по
 * подписанным ссылкам, а путь обязан начинаться с идентификатора владельца —
 * на этом стоят все четыре политики.
 */

const BUCKET = "covers"

/** Час. Ссылка живёт дольше обычного сеанса работы, но не вечно. */
const TTL = 3600

export async function uploadCover(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const res = await client().storage.from(BUCKET).upload(path, file, { contentType: file.type })
  unwrap("upload/cover", res)
  return path
}

/** Пачкой: по ссылке на запрос вместо запроса на каждую плитку. */
export async function signCovers(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (paths.length === 0) return out
  const res = await client().storage.from(BUCKET).createSignedUrls(paths, TTL)
  const rows = unwrap<Array<{ path: string | null; signedUrl: string | null }>>("sign/covers", res)
  for (const r of rows) if (r.path && r.signedUrl) out.set(r.path, r.signedUrl)
  return out
}
