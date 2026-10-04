import { useEffect, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import type { Board, Format, Post, Series, SeriesKind, Status } from "../types/model"
import { seriesLookup } from "../lib/series"
import { placeholderCover } from "../lib/cover"
import { queue } from "../lib/feed"
import { postShape } from "../lib/post"
import { knownTags, tagKey, withTag, withoutTag } from "../lib/tags"
import { FORMAT_ICON, FORMAT_LABEL } from "../ui/formats"
import { SERIES_PALETTE, nextColor } from "../ui/palette"
import { CHOICE, DIALOG, FIELD, LABEL, PRIMARY, QUIET } from "../ui/form"

/**
 * Заведение и правка поста — **одна форма**. Поля те же, и разделять их значило
 * бы держать два места, где заголовок называется заголовком.
 *
 * Устройство из `spec 001`, пункты 3–5: состояние и формат парой, превью рядом
 * с полями, серия заводится прямо отсюда. Последнее — эргономика из версии
 * ChatGPT; модель при этом остаётся нашей, то есть серия настоящая, с цветом и
 * видом, а не свободная строка.
 *
 * Отдельной карточки поста пока нет нарочно: показывать в ней, кроме этих же
 * полей, нечего — полный кадр появится вместе с обложками, и тогда у карточки
 * будет содержание.
 */

const STATUSES: Array<{ id: Status; label: string }> = [
  { id: "planned", label: "Запланирован" },
  { id: "posted", label: "Опубликован" },
  { id: "idea", label: "Идея" },
]

export type Submitted = { post: Post; series?: Series }

export function PostForm({
  board,
  post,
  onSubmit,
  onUpload,
  coverUrl,
  onDelete,
  onCancel,
}: {
  board: Board
  /** Пост, который правим. Отсутствует — значит заводим новый. */
  post?: Post
  onSubmit: (made: Submitted) => void
  /** Кладёт файл в хранилище и возвращает путь. Нет — обложку менять нельзя. */
  onUpload?: (file: File) => Promise<string>
  /** Подписанная ссылка на нынешнюю обложку поста. */
  coverUrl?: string
  /** Отсутствует там, где удалять нельзя: кнопки тогда нет, а не отключена. */
  onDelete?: (id: string) => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const lookup = seriesLookup(board)

  const [heading, setHeading] = useState(post?.heading ?? "")
  const [subheading, setSubheading] = useState(post?.subheading ?? "")
  const [description, setDescription] = useState(post?.description ?? "")
  const [format, setFormat] = useState<Format>(post?.format ?? "carousel")
  const [status, setStatus] = useState<Status>(post?.status ?? "planned")
  const [seriesId, setSeriesId] = useState<string>(post?.seriesId ?? "")
  // Поле дня одно, а смысл у него разный: у вышедшего это день выхода, у
  // запланированного — ориентир. Показывается тот, который у поста есть.
  const [day, setDay] = useState(post?.publishedOn ?? post?.targetOn ?? "")
  const [tags, setTags] = useState<string[]>(post?.tags ?? [])
  const [newTag, setNewTag] = useState("")
  const [removing, setRemoving] = useState(false)

  // Файл уезжает в хранилище сразу при выборе: к отправке формы путь уже
  // есть, и запись поста остаётся одной строкой без ожидания загрузки.
  const [coverPath, setCoverPath] = useState(post?.coverPath ?? null)
  const [picked, setPicked] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // Новая серия заводится здесь же, чтобы не уходить в настройки ради одного имени.
  const [makingSeries, setMakingSeries] = useState(false)
  const [newName, setNewName] = useState("")
  const [newKind, setNewKind] = useState<SeriesKind>("finite")
  // Пусто — заводим серию верхнего уровня, иначе сюжет внутри выбранной.
  const [newParent, setNewParent] = useState("")
  const [newColor, setNewColor] = useState(() => nextColor(board.series.map(s => s.color)))

  useEffect(() => { dialog.current?.showModal() }, [])

  const ready =
    heading.trim().length > 0 && (!makingSeries || newName.trim().length > 0) && !sending

  async function pick(file: File | undefined) {
    if (!file || !onUpload) return
    setFailed(null)
    setSending(true)
    // Своя ссылка на файл показывает кадр сразу, не дожидаясь подписи.
    setPicked(URL.createObjectURL(file))
    try {
      setCoverPath(await onUpload(file))
    } catch (err: unknown) {
      setPicked(null)
      setFailed(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return

    let series: Series | undefined
    let targetSeries = seriesId || null

    if (makingSeries) {
      // Цвет и вид есть только у верхнего уровня: у сюжета их нет, и это
      // проверяет ограничение `series_root_fields` в базе.
      series = newParent
        ? {
            id: crypto.randomUUID(),
            parentId: newParent,
            name: newName.trim(),
            color: null,
            kind: null,
          }
        : {
            id: crypto.randomUUID(),
            parentId: null,
            name: newName.trim(),
            color: newColor,
            kind: newKind,
          }
      targetSeries = series.id
    }

    // Новый запланированный встаёт в конец очереди: трогается одна строка — его
    // собственная, и ни один сосед не переписывается.
    const last = queue(board.posts).at(-1)?.rank ?? null

    onSubmit({
      series,
      post: {
        id: post?.id ?? crypto.randomUUID(),
        seriesId: targetSeries,
        format,
        status,
        archived: post?.archived ?? false,
        ...postShape(status, day, post ?? null, last),
        heading: heading.trim(),
        subheading: subheading.trim(),
        description: description.trim(),
        tags,
        coverPath,
      },
    })
  }

  const known = knownTags(board.posts)
  // Показываются первые двенадцать по частоте: меток может быть полсотни,
  // и стена чипсов тяжелее, чем поле набора.
  const shownTags = [...new Set([...tags, ...known.slice(0, 12)])]

  function addTag() {
    setTags(was => withTag(was, newTag, known))
    setNewTag("")
  }

  const previewColor =
    makingSeries && !newParent
      ? newColor
      : makingSeries && newParent
        ? lookup.colorOf(newParent)
        : lookup.colorOf(seriesId || null)
  // Только что выбранный файл главнее подписанной ссылки: она ещё старая.
  const shown = picked ?? (coverPath && coverPath === post?.coverPath ? coverUrl : null)

  return (
    <dialog
      ref={dialog}
      onCancel={onCancel}
      onClick={e => { if (e.target === dialog.current) onCancel() }}
      className={DIALOG}
    >
      <form onSubmit={submit} className="grid max-h-[86dvh] grid-cols-[132px_1fr] gap-4 overflow-y-auto p-5">
        {/* Превью рядом с полями: когда описываешь кадр, его надо видеть. Пока
            обложек нет — это оттенок серии, то есть видно, в какой цвет пост
            встанет в сетке. */}
        <div className="grid content-start gap-2">
          <div
            className="aspect-[4/5] w-full rounded-lg bg-cover bg-center"
            style={{
              backgroundImage: shown
                ? `url("${shown}")`
                : placeholderCover(heading || "новый", previewColor),
            }}
          />
          {onUpload ? (
            <>
              <label className="cursor-pointer rounded-lg bg-ink/[0.05] px-2 py-1.5 text-center text-[11.5px] font-medium hover:bg-ink/10">
                {sending ? "Загружаю…" : shown ? "Заменить" : "Выбрать обложку"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => void pick(e.target.files?.[0])}
                />
              </label>
              {failed ? (
                <p className="text-[10.5px] leading-snug text-warn">{failed}</p>
              ) : (
                <p className="text-[10.5px] leading-snug text-ink/45">
                  Кадр обрежется до 4:5 по центру — как в профиле
                </p>
              )}
            </>
          ) : (
            <p className="text-[10.5px] leading-snug text-ink/45">
              Обложка ставится позже — это цвет серии
            </p>
          )}
        </div>

        <div className="grid content-start gap-3.5">
          <div>
            <label className={LABEL} htmlFor="heading">Заголовок</label>
            <input
              id="heading"
              value={heading}
              onChange={e => setHeading(e.target.value)}
              placeholder="О чём этот пост в одной строке"
              className={FIELD}
              autoFocus
              required
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="subheading">Подзаголовок</label>
            <input
              id="subheading"
              value={subheading}
              onChange={e => setSubheading(e.target.value)}
              placeholder="Детали одной строкой"
              className={FIELD}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="description">Описание</label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Длинный текст: черновик подписи, заметки, список кадров"
              rows={3}
              className={`${FIELD} resize-y`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={LABEL}>Формат</span>
              <div className="flex gap-1">
                {(Object.keys(FORMAT_LABEL) as Format[]).map(f => {
                  const Icon = FORMAT_ICON[f]
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      aria-pressed={format === f}
                      title={FORMAT_LABEL[f]}
                      className={`${CHOICE(format === f)} grid place-items-center`}
                    >
                      <Icon size={15} strokeWidth={1.9} />
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <span className={LABEL}>Состояние</span>
              <div className="flex gap-1">
                {STATUSES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    aria-pressed={status === s.id}
                    className={CHOICE(status === s.id)}
                  >
                    {s.id === "planned" ? "План" : s.id === "posted" ? "Вышел" : "Идея"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* У идеи нет места в очереди, значит нет и дня, который его дал бы. */}
          {status !== "idea" && (
            <div>
              <label className={LABEL} htmlFor="day">
                {status === "posted" ? "Когда вышел" : "Ориентир — необязательно"}
              </label>
              <input
                id="day"
                type="date"
                value={day}
                onChange={e => setDay(e.target.value)}
                className={FIELD}
              />
              {status === "planned" && (
                <p className="mt-1 text-[11px] text-ink/45">
                  Порядком не управляет: пост встанет в конец очереди
                </p>
              )}
            </div>
          )}

          <div>
            <label className={LABEL} htmlFor="series">Серия</label>
            {makingSeries ? (
              <div className="grid gap-2">
                <input
                  id="series-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Название серии"
                  className={FIELD}
                  autoFocus
                />
                {/* Сюжет — второй и последний уровень: «4 поста про Губэй»
                    внутри «Китай. Пекин». Глубже не бывает, это держит
                    триггер `series_two_levels()`. */}
                <select
                  value={newParent}
                  onChange={e => setNewParent(e.target.value)}
                  className={FIELD}
                >
                  <option value="">Новая серия верхнего уровня</option>
                  {lookup.roots.map(root => (
                    <option key={root.id} value={root.id}>Сюжет внутри «{root.name}»</option>
                  ))}
                </select>

                {!newParent && (
                  <>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setNewKind("finite")}
                        aria-pressed={newKind === "finite"} className={CHOICE(newKind === "finite")}>
                        Конечная
                      </button>
                      <button type="button" onClick={() => setNewKind("rubric")}
                        aria-pressed={newKind === "rubric"} className={CHOICE(newKind === "rubric")}>
                        Рубрика
                      </button>
                    </div>
                    <p className="text-[11px] leading-snug text-ink/45">
                      Конечную доводят до финала, рубрику подсыпают между плотными кусками
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SERIES_PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          aria-label={`Цвет ${c}`}
                          aria-pressed={newColor === c}
                          className={`h-5 w-5 rounded-md ${newColor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {newParent && (
                  <p className="text-[11px] leading-snug text-ink/45">
                    Цвет сюжет берёт у своей серии — он один на всю серию
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setMakingSeries(false)}
                  className="justify-self-start text-[12px] text-ink/45 underline underline-offset-2 hover:text-ink"
                >
                  Выбрать из существующих
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                <select
                  id="series"
                  value={seriesId}
                  onChange={e => setSeriesId(e.target.value)}
                  className={FIELD}
                >
                  <option value="">Вне серий</option>
                  {lookup.roots.map(root => (
                    <optgroup key={root.id} label={root.name}>
                      <option value={root.id}>{root.name} — прямо в серии</option>
                      {lookup.childrenOf(root.id).map(plot => (
                        <option key={plot.id} value={plot.id}>{plot.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMakingSeries(true)}
                  className="justify-self-start text-[12px] text-ink/45 underline underline-offset-2 hover:text-ink"
                >
                  Завести новую серию
                </button>
              </div>
            )}
          </div>

          <div>
            <span className={LABEL}>Метки</span>
            <div className="flex flex-wrap gap-1.5">
              {shownTags.map(t => {
                const on = tags.some(x => tagKey(x) === tagKey(t))
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTags(was => (on ? withoutTag(was, t) : withTag(was, t, known)))
                    }
                    className={`rounded-full px-2.5 py-1 text-[12px] ${
                      on ? "bg-ink text-on-fill" : "bg-ink/[0.05] text-ink/70 hover:text-ink"
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
              {known.length > shownTags.length && (
                <span className="self-center text-[11px] text-ink/45">
                  и ещё {known.length - shownTags.length} — найдутся по набору
                </span>
              )}
            </div>

            {/* Новая метка заводится здесь же, но сверяется с уже
                заведёнными без учёта регистра: «Люди» не должны
                раздвоиться на «люди». */}
            <div className="mt-2 flex gap-1.5">
              <input
                id="tags"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Новая метка"
                className={FIELD}
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!newTag.trim()}
                className="rounded-[10px] bg-ink/[0.05] px-3 text-[12px] font-medium hover:bg-ink/10 disabled:opacity-40"
              >
                Добавить
              </button>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={!ready}
              className={PRIMARY}
            >
              {post ? "Сохранить" : "Добавить"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={QUIET}
            >
              Отмена
            </button>

            {/* Спрашивает здесь же, а не системным окном: отменить удаление
                нечем — журнала изменений ещё нет. */}
            {post && onDelete && (
              <span className="ml-auto flex items-center gap-2">
                {removing ? (
                  <>
                    <span className="text-[11.5px] text-ink/70">Удалить насовсем?</span>
                    <button
                      type="button"
                      onClick={() => onDelete(post.id)}
                      className="rounded-[10px] bg-warn px-3 py-2 text-[12px] font-semibold text-on-fill"
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(false)}
                      className="text-[12px] text-ink/45 underline underline-offset-2 hover:text-ink"
                    >
                      Нет
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRemoving(true)}
                    title="Удалить пост"
                    aria-label="Удалить пост"
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink/45 hover:bg-ink/[0.05] hover:text-warn"
                  >
                    <Trash2 size={15} strokeWidth={1.9} />
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </form>
    </dialog>
  )
}
