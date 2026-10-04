import type { Board } from "../types/model"
import { RANK_STEP } from "../lib/rank"

/**
 * Образец доски для режима разработки: `localhost:5174/?demo=1`.
 *
 * Нужен затем, что вид надо проверять, не трогая настоящие данные и не входя в
 * чужой аккаунт. Это же готовый набор для любой будущей работы над рисованием:
 * здесь нарочно есть всё, на чём разметка ломается — пост без ориентира,
 * ориентир в прошлом, расхождение с очередью, архив, идеи, сюжеты, сторис всех
 * трёх привязок и три актуальных из ADR 0005.
 *
 * Данные те же, что в прототипе, чтобы два образца не разошлись.
 */

const r = (n: number) => n * RANK_STEP

export const DEMO_BOARD: Board = {
  series: [
    { id: "cn", parentId: null, name: "Пекин", color: "#B8422F", kind: "finite" },
    { id: "cn-jingshan", parentId: "cn", name: "Цзиншань", color: null, kind: null },
    { id: "cn-night", parentId: "cn", name: "Ночной Пекин", color: null, kind: null },
    { id: "cn-food", parentId: "cn", name: "Пекинская еда", color: null, kind: null },
    { id: "duo", parentId: null, name: "Мы вдвоём", color: "#7D6AA8", kind: "rubric" },
    { id: "places", parentId: null, name: "Я и места", color: "#3E7C8C", kind: "rubric" },
  ],

  posts: [
    { id: "p01", seriesId: "places", format: "single", status: "posted", archived: true,
      publishedOn: "2026-08-22", targetOn: null, rank: null,
      heading: "Лучший суп в моей жизни был в подвале",
      subheading: "Случайная забегаловка на две табуретки, вывеска от руки. Фото на вытянутой руке, лицо — отдельный жанр.",
      description: "",
      tags: ["смешное", "я в кадре", "еда"], coverPath: null },

    { id: "p02", seriesId: "duo", format: "single", status: "posted", archived: false,
      publishedOn: "2026-08-30", targetOn: null, rank: null,
      heading: "Мы и очень большой десерт",
      subheading: "Взяли один на двоих, съели каждый свой. Тёплый кадр, ничего не планировали, и поэтому он работает.",
      description: "",
      tags: ["тёплое", "я в кадре", "вдвоём"], coverPath: null },

    // Вышел позже, чем собирался: ориентир переживает публикацию нарочно.
    { id: "p03", seriesId: "cn-jingshan", format: "carousel", status: "posted", archived: false,
      publishedOn: "2026-09-12", targetOn: "2026-09-10", rank: null,
      heading: "Парк, в который приходят жить",
      subheading: "Цзиншань целиком: пионы, фудкорты, люди в костюмах династии и мужчина, который поёт у стены каждое утро. Десять кадров, чтобы стало понятно: это не музей, а район.",
      description: "",
      tags: ["люди", "цвет", "день"], coverPath: null },

    { id: "p04", seriesId: "cn-jingshan", format: "carousel", status: "posted", archived: false,
      publishedOn: "2026-09-18", targetOn: null, rank: null,
      heading: "Павильон Ваньчунь",
      subheading: "Самая высокая точка старого Пекина. Вид на Гугун сверху, очередь на подъём и почему сюда идут именно к закату.",
      description: "",
      tags: ["вид", "архитектура", "закат"], coverPath: null },

    { id: "p05", seriesId: "cn-food", format: "carousel", status: "posted", archived: false,
      publishedOn: "2026-09-26", targetOn: null, rank: null,
      heading: "Я не прочитал ни одного меню",
      subheading: "Утка, лапша с кунжутной пастой, баоцзы на пару и штука, название которой я до сих пор не знаю. Заказывал пальцем.",
      description: "",
      tags: ["еда", "цвет", "смешное"], coverPath: null },

    { id: "p06", seriesId: "cn", format: "reel", status: "posted", archived: false,
      publishedOn: "2026-10-01", targetOn: null, rank: null,
      heading: "Пекин на скорости",
      subheading: "Монтаж из метро, хутунов и вечерней Ванфуцзин. Двадцать секунд, чтобы было понятно, какой это город.",
      description: "",
      tags: ["движение", "город"], coverPath: null },

    // Ориентир уже в прошлом — первое расхождение.
    { id: "p07", seriesId: "cn-jingshan", format: "carousel", status: "planned", archived: false,
      publishedOn: null, targetOn: "2026-10-02", rank: r(1),
      heading: "Вечерняя архитектура Цзиншаня",
      subheading: "Те же постройки после заката: подсветка, красные колонны, пустые дорожки, синий воздух. Снимал в последний вечер.",
      description: "",
      tags: ["архитектура", "вечер", "цвет"], coverPath: null },

    // Стоит в очереди раньше p09, а намечен позже — второе расхождение.
    { id: "p08", seriesId: "cn-night", format: "reel", status: "planned", archived: false,
      publishedOn: null, targetOn: "2026-10-20", rank: r(2),
      heading: "Что мы делали ночами",
      subheading: "Ночной Пекин: барахолка, караоке, велосипеды в три часа и очередь за шашлыком. Самый быстрый монтаж из всей поездки.",
      description: "",
      tags: ["движение", "ночь", "смешное"], coverPath: null },

    { id: "p09", seriesId: "cn-night", format: "carousel", status: "planned", archived: false,
      publishedOn: null, targetOn: "2026-10-17", rank: r(3),
      heading: "Люди ночного Пекина",
      subheading: "Портреты тех, кого встретили: таксист, продавец шашлыков, две девушки с гитарой у перехода. Снято на 35 мм, почти без света.",
      description: "",
      tags: ["люди", "ночь"], coverPath: null },

    // Без ориентира: просто стоит в очереди.
    { id: "p10", seriesId: "cn", format: "single", status: "planned", archived: false,
      publishedOn: null, targetOn: null, rank: r(4),
      heading: "Один кадр, который всё объясняет",
      subheading: "Финал серии про Пекин. Одно фото, подпись в три строки, больше ничего — после четырёх каруселей нужна пауза.",
      description: "",
      tags: ["тихое", "город"], coverPath: null },

    { id: "p11", seriesId: "duo", format: "reel", status: "idea", archived: false,
      publishedOn: null, targetOn: null, rank: null,
      heading: "Как мы собирались в поездку",
      subheading: "Короткий смешной монтаж из домашних съёмок до отлёта. Хорошо встал бы перед началом китайской серии.",
      description: "",
      tags: ["смешное", "вдвоём", "движение"], coverPath: null },

    { id: "p12", seriesId: null, format: "single", status: "idea", archived: false,
      publishedOn: null, targetOn: null, rank: null,
      heading: "Я и кофе в семь утра",
      subheading: "Просто хороший кадр без повода. Держу как разрядку между плотными сериями.",
      description: "",
      tags: ["тихое", "я в кадре"], coverPath: null },
  ],

  stories: [
    { id: "s01", attachPostId: "p01", attachSeriesId: null, role: "pointer", onDate: null,
      body: "Скрин вывески со стрелкой на пост" },
    { id: "s02", attachPostId: "p03", attachSeriesId: null, role: "teaser", onDate: null,
      body: "Опрос: Гугун или парк напротив?" },
    // Закулисье на посте — то, чего старая схема четырёх видов не умела.
    { id: "s03", attachPostId: "p03", attachSeriesId: null, role: "behind", onDate: null,
      body: "Как я десять минут ждал, пока уйдут из кадра" },
    { id: "s04", attachPostId: "p04", attachSeriesId: null, role: "pointer", onDate: null,
      body: "Вид сверху вертикально, в посте ещё восемь" },
    { id: "s05", attachPostId: "p06", attachSeriesId: null, role: "teaser", onDate: null,
      body: "Три секунды из монтажа, без звука" },
    { id: "s06", attachPostId: "p08", attachSeriesId: null, role: "teaser", onDate: null,
      body: "Кадр с караоке, вопрос «угадай город»" },
    { id: "s07", attachPostId: "p08", attachSeriesId: null, role: "teaser", onDate: null,
      body: "Обратный отсчёт за сутки" },
    { id: "s08", attachPostId: null, attachSeriesId: "cn", role: "behind", onDate: null,
      body: "Как собиралась вся поездка: маршрут, визы и что не влезло" },
    // Отсылка к серии — второе, чего старая схема не выражала.
    { id: "s09", attachPostId: null, attachSeriesId: "cn", role: "pointer", onDate: null,
      body: "Серия про Пекин закончилась — все посты подряд" },
    { id: "s10", attachPostId: null, attachSeriesId: null, role: null, onDate: "2026-09-08",
      body: "Сборы, чемодан, паспорт" },
    { id: "s11", attachPostId: null, attachSeriesId: null, role: null, onDate: "2026-09-21",
      body: "Прогулка по хутунам, ничего не вышло в пост" },
    { id: "s12", attachPostId: null, attachSeriesId: null, role: null, onDate: "2026-10-02",
      body: "Отвечаю на вопросы про визу" },
  ],

  // Три случая из ADR 0005: совпадает с серией, не может иметь её, пересекает несколько.
  highlights: [
    { id: "h1", seriesId: "cn", name: "Пекин", coverPath: null, assembled: false,
      storyIds: ["s02", "s03", "s04", "s05", "s08"] },
    { id: "h2", seriesId: null, name: "Обо мне", coverPath: null, assembled: true, storyIds: ["s12"] },
    { id: "h3", seriesId: null, name: "Еда", coverPath: null, assembled: true, storyIds: ["s01"] },
  ],
}

/** Сегодня в образце зафиксировано, иначе расхождения перестанут быть видны. */
export const DEMO_TODAY = "2026-10-04"
