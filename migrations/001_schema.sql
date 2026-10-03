-- 001 — схема доски: серия, пост, сторис, актуальное.
--
-- Применяется вручную в SQL-редакторе Supabase. Решения, из которых она
-- выведена: ADR 0001 (Supabase, RLS как самое опасное место), ADR 0002 (одна
-- правка — одна строка), ADR 0003 (ориентир не управляет порядком),
-- ADR 0004 (сторис — выпуск, привязка × роль), ADR 0005 (актуальное — не серия).
--
-- Данные здесь принадлежат разным людям. Поэтому права выдаются явно и только
-- роли authenticated, роль anon не получает ничего, а RLS отбирает строки по
-- владельцу. Полагаться на настройку проекта «не выкладывать новые таблицы»
-- нельзя: она могла остаться невключённой.

begin;

-- ---------------------------------------------------------------- серии

create table public.series (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- Сюжет — это серия с родителем. Уровней ровно два, см. триггер ниже.
  parent_id   uuid references public.series (id) on delete cascade,

  name        text not null check (length(btrim(name)) > 0),

  -- Цвет и вид принадлежат верхнему уровню: сюжет наследует их от серии.
  -- Отсюда и ограничение — у корня они есть, у сюжета их нет.
  color       text,
  kind        text check (kind in ('finite', 'rubric')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint series_root_fields check (
    (parent_id is null     and color is not null and kind is not null) or
    (parent_id is not null and color is null     and kind is null)
  )
);

-- Два уровня, не три. Проверяются обе стороны: нельзя повесить сюжет на сюжет
-- и нельзя превратить в сюжет серию, у которой сюжеты уже есть.
create or replace function public.series_two_levels()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.series s
                where s.id = new.parent_id and s.parent_id is not null) then
      raise exception 'Сюжет не может иметь своих сюжетов: вложенность только на один уровень';
    end if;
    if exists (select 1 from public.series s where s.parent_id = new.id) then
      raise exception 'У этой серии есть сюжеты — она не может сама стать сюжетом';
    end if;
  end if;
  return new;
end;
$$;

create trigger series_two_levels
  before insert or update of parent_id on public.series
  for each row execute function public.series_two_levels();

-- ---------------------------------------------------------------- посты

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- NULL — «вне серий». Это ответ, а не пропуск.
  series_id     uuid references public.series (id) on delete set null,

  format        text not null check (format in ('reel', 'single', 'carousel')),
  status        text not null check (status in ('posted', 'planned', 'idea')),

  -- Архив ортогонален состоянию: заархивированный пост всё равно опубликован.
  archived      boolean not null default false,

  -- Настоящий день выхода. Есть только у опубликованного.
  published_on  date,

  -- Ориентир: необязателен, ничем не управляет и переживает публикацию, чтобы
  -- «собирался 10-го, вышло 12-го» осталось видно (ADR 0003).
  target_on     date,

  -- Дробный ранг — единственный источник правды о последовательности
  -- запланированного. Перетаскивание меняет одну строку (ADR 0002).
  rank          double precision,

  heading       text not null default '',
  subheading    text not null default '',

  -- Метки массивом, а не отдельной таблицей: смена меток у поста — одна
  -- запись, переименование метки везде — один array_replace (ADR 0002).
  tags          text[] not null default '{}',

  cover_path    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint posts_posted_has_day  check (status <> 'posted'  or published_on is not null),
  constraint posts_planned_has_rank check (status <> 'planned' or rank is not null),

  -- У идеи нет места в очереди, значит нет и дня, который это место дало бы.
  constraint posts_idea_is_bare check (
    status <> 'idea' or (published_on is null and target_on is null and rank is null)
  )
);

-- ---------------------------------------------------------------- сторис

create table public.stories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Привязка: пост, серия или ничего. Заполнено не больше одного.
  attach_post_id    uuid references public.posts (id) on delete cascade,
  attach_series_id  uuid references public.series (id) on delete cascade,

  -- Роль необязательна: у прогулки, из которой ничего не вышло, её нет.
  role              text check (role in ('teaser', 'pointer', 'behind')),

  -- Свой день. Если его нет, а привязка к посту есть, день выводится по роли
  -- при чтении и не хранится.
  on_date           date,

  body              text not null default '',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint stories_one_attachment check (
    num_nonnulls(attach_post_id, attach_series_id) <= 1
  )
);

-- ---------------------------------------------------------------- актуальное

create table public.highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- Необязательная ссылка на серию: «Пекин» сошлётся, «Обо мне» нет,
  -- «Еда» пересекает несколько (ADR 0005).
  series_id   uuid references public.series (id) on delete set null,

  name        text not null check (length(btrim(name)) > 0),
  cover_path  text,

  -- Задумано или уже собрано в профиле.
  assembled   boolean not null default false,

  -- Набор сторис массивом: собрать актуальное — одна запись, порядок внутри
  -- (сторис играют подряд) — это порядок массива, и одна сторис может лежать
  -- в двух актуальных.
  story_ids   uuid[] not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Массив не знает внешних ключей, поэтому ссылочную целостность возвращает
-- триггер: удалённая сторис исчезает из всех наборов.
create or replace function public.highlights_forget_story()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.highlights
     set story_ids = array_remove(story_ids, old.id),
         updated_at = now()
   where user_id = old.user_id
     and story_ids @> array[old.id];
  return old;
end;
$$;

create trigger stories_forget
  after delete on public.stories
  for each row execute function public.highlights_forget_story();

-- ---------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger series_touch     before update on public.series
  for each row execute function public.touch_updated_at();
create trigger posts_touch      before update on public.posts
  for each row execute function public.touch_updated_at();
create trigger stories_touch    before update on public.stories
  for each row execute function public.touch_updated_at();
create trigger highlights_touch before update on public.highlights
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- индексы

-- Индекс по user_id обязателен: без него политика RLS сканирует таблицу на
-- каждый запрос, и это самая дорогая ошибка из возможных здесь.
create index series_user      on public.series     using btree (user_id);
create index series_parent    on public.series     using btree (user_id, parent_id);

create index posts_user       on public.posts      using btree (user_id);
create index posts_queue      on public.posts      using btree (user_id, rank) where status = 'planned';
create index posts_published  on public.posts      using btree (user_id, published_on desc) where status = 'posted';
create index posts_series     on public.posts      using btree (series_id);
create index posts_tags       on public.posts      using gin  (tags);

create index stories_user     on public.stories    using btree (user_id);
create index stories_post     on public.stories    using btree (attach_post_id);
create index stories_series   on public.stories    using btree (attach_series_id);

create index highlights_user  on public.highlights using btree (user_id);
create index highlights_story on public.highlights using gin  (story_ids);

-- ---------------------------------------------------------------- права

-- Явно и узко. anon не получает ничего: анонимный ключ лежит в клиентской
-- сборке в открытом виде, и всё, что ему выдано, выдано всему интернету.
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.series, public.posts, public.stories, public.highlights
  to authenticated;

revoke all
  on public.series, public.posts, public.stories, public.highlights
  from anon;

-- ---------------------------------------------------------------- RLS

alter table public.series     enable row level security;
alter table public.posts      enable row level security;
alter table public.stories    enable row level security;
alter table public.highlights enable row level security;

-- auth.uid() обёрнут в select намеренно: так планировщик считает его один раз
-- на запрос, а не на каждую строку.
create policy "own series" on public.series for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own posts" on public.posts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own stories" on public.stories for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own highlights" on public.highlights for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
