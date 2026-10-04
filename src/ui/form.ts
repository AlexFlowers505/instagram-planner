/**
 * Общая одежда полей для всех окон заведения. Лежит отдельно от компонентов,
 * потому что модуль экспортирует либо компоненты, либо значения.
 */

export const FIELD =
  "w-full rounded-[10px] bg-ink/[0.05] px-3 py-2 text-[13px] text-ink outline-none " +
  "placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-ink/45"

export const LABEL = "mb-1.5 block text-[10.5px] font-medium tracking-[0.06em] text-ink/45 uppercase"

export const CHOICE = (on: boolean) =>
  `flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${
    on ? "bg-ink text-on-fill" : "bg-ink/[0.05] text-ink/70 hover:text-ink"
  }`

export const DIALOG =
  "m-auto w-full max-w-[560px] rounded-2xl bg-surface p-0 text-ink " +
  "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"

export const PRIMARY =
  "rounded-[10px] bg-ink px-4 py-2 text-[13px] font-semibold text-on-fill disabled:opacity-40"

export const QUIET = "rounded-[10px] bg-ink/[0.05] px-3.5 py-2 text-[13px] font-medium hover:bg-ink/10"
