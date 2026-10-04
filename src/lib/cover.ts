/**
 * Заглушка обложки.
 *
 * Это **не картинка и не притворяется ею**: лёгкий оттенок цвета серии, чтобы
 * стена заглушек читалась как пустые рамки в ожидании фотографий, а не как
 * стена тяжёлых пятен. Серию в полную силу несёт рейка, а не это.
 */

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function placeholderCover(seed: string, color: string): string {
  const h = hash(seed)
  const x1 = 18 + (h % 46)
  const y1 = 12 + ((h >> 3) % 42)
  const x2 = 52 + ((h >> 6) % 38)
  const y2 = 52 + ((h >> 9) % 40)
  const ang = (h >> 12) % 360
  return [
    `radial-gradient(56% 68% at ${x1}% ${y1}%, color-mix(in oklab, ${color} 16%, var(--color-surface)) 0%, transparent 64%)`,
    `radial-gradient(60% 60% at ${x2}% ${y2}%, color-mix(in oklab, ${color} 34%, var(--color-surface)) 0%, transparent 68%)`,
    `linear-gradient(${ang}deg, color-mix(in oklab, ${color} 14%, var(--color-surface)) 0%, color-mix(in oklab, ${color} 27%, var(--color-surface)) 100%)`,
  ].join(", ")
}
