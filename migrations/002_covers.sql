-- 002 — хранилище обложек.
--
-- Применяется вручную в SQL-редакторе Supabase, после 001.
--
-- Обложка — сжатая копия шириной около 600 точек, не оригинал (ADR 0004 и
-- `docs/wiki/model.md`). При 60 КБ на штуку бесплатный гигабайт — это тысячи
-- обложек, то есть запас на годы.
--
-- Путь: {user_id}/{post_id}.jpg и {user_id}/hl-{highlight_id}.jpg.
-- Первый сегмент пути — владелец, и на этом держатся все четыре политики.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Приватный бакет: ссылка на файл выдаётся подписанной и на время. Публичный
-- бакет означал бы, что любой, кто угадал путь, читает чужие обложки, а пути
-- здесь угадываемые — это идентификаторы.

create policy "own covers: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own covers: write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own covers: replace" on storage.objects for update to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "own covers: delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
