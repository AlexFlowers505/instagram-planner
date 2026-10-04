import { Film, Image as ImageIcon, Images } from "lucide-react"
import type { Format } from "../types/model"

/**
 * Формат рисуется **глифом, а не цветом**: ни один формат не лучше другого, а
 * цвет на трёх значениях неизбежно читается как оценка. Цвет здесь принадлежит
 * серии.
 *
 * Отдельный файл, потому что модуль в `views/` экспортирует либо компоненты,
 * либо значения — иначе отваливается горячая перезагрузка.
 */

export const FORMAT_ICON: Record<Format, typeof Film> = {
  reel: Film,
  carousel: Images,
  single: ImageIcon,
}

export const FORMAT_LABEL: Record<Format, string> = {
  reel: "Рилс",
  carousel: "Карусель",
  single: "Одно фото",
}

/** Сколько показано вокруг картинки. Одна ось, три значения. */
export type Density = "captions" | "covers" | "flush"
