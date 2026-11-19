-- My Bible: sync between devices (highlights, notes, reading plan, chapter counts, bookmarks, history, memory verses).
-- Lives in the Stobite Buy Supabase project (hfamehbhdwptnlwmjsgi) alongside that app's tables. This script only ADDS
-- objects named bible_*; it changes nothing that Stobite Buy uses. Safe to run more than once.
-- One row per document per user, e.g. id 'm-42.3.16' (a highlight/note), 'x-plan', 'x-reading', 'x-bookmarks'.

create table if not exists public.bible_docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 80),
  data       jsonb       not null default '{}'::jsonb check (pg_column_size(data) < 262144),  -- 256 KB a document, so this app can't eat Stobite Buy's storage
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists bible_docs_user_updated on public.bible_docs (user_id, updated_at);

alter table public.bible_docs enable row level security;

-- Each person can only see and change their own rows.
drop policy if exists bible_docs_select_own on public.bible_docs;
drop policy if exists bible_docs_insert_own on public.bible_docs;
drop policy if exists bible_docs_update_own on public.bible_docs;
drop policy if exists bible_docs_delete_own on public.bible_docs;
create policy bible_docs_select_own on public.bible_docs for select to authenticated using (user_id = (select auth.uid()));
create policy bible_docs_insert_own on public.bible_docs for insert to authenticated with check (user_id = (select auth.uid()));
create policy bible_docs_update_own on public.bible_docs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bible_docs_delete_own on public.bible_docs for delete to authenticated using (user_id = (select auth.uid()));

-- The server stamps every change, so device clocks don't matter when syncing.
create or replace function public.bible_docs_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists bible_docs_touch on public.bible_docs;
create trigger bible_docs_touch before insert or update on public.bible_docs
  for each row execute function public.bible_docs_touch();

revoke all on public.bible_docs from anon;
grant select, insert, update, delete on public.bible_docs to authenticated;
