-- Run once in Supabase SQL Editor. Uses publishable/anon key + user JWT, never service_role.
begin;
create table if not exists public.idea_spaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint idea_space_size check (octet_length(document::text) <= 2097152),
  constraint idea_space_document check ((jsonb_typeof(document) = 'object' and document ->> 'version' = '1' and jsonb_typeof(document -> 'project') = 'object' and jsonb_typeof(document -> 'library') = 'object') is true)
);
alter table public.idea_spaces enable row level security;
revoke all on public.idea_spaces from anon;
grant select, insert, update, delete on public.idea_spaces to authenticated;
create policy "Read own space" on public.idea_spaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own space" on public.idea_spaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own space" on public.idea_spaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own space" on public.idea_spaces for delete to authenticated using ((select auth.uid()) = user_id);

-- Compare-and-swap: concurrent devices cannot silently overwrite a newer revision.
create or replace function public.save_idea_space(p_expected_revision integer, p_document jsonb)
returns setof public.idea_spaces
language plpgsql security invoker set search_path = public
as $$
declare changed public.idea_spaces;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
  if p_expected_revision = 0 then
    insert into public.idea_spaces(user_id, document, revision)
    values(auth.uid(), p_document, 1) on conflict (user_id) do nothing returning * into changed;
  else
    update public.idea_spaces set document = p_document, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_expected_revision returning * into changed;
  end if;
  if changed.user_id is null then raise exception 'Newer revision exists' using errcode = '40001'; end if;
  return next changed;
end;
$$;
revoke all on function public.save_idea_space(integer, jsonb) from public, anon;
grant execute on function public.save_idea_space(integer, jsonb) to authenticated;
commit;
