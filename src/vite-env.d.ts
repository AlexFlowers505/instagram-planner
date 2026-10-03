/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** https://<ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /**
   * Публикуемый ключ (`sb_publishable_…`). Он называет проект и не даёт
   * ничего: защищает RLS. Секретный ключ сюда класть нельзя — всё с
   * префиксом VITE_ попадает в клиентскую сборку открытым текстом.
   */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
