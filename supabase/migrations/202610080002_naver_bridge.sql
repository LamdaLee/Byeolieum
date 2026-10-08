begin;
create table public.naver_identities (
  subject_hash text primary key check (length(subject_hash)=64),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
create table public.naver_login_handoffs (
  nonce_hash text primary key check (length(nonce_hash)=64),
  sealed_session text not null check (octet_length(sealed_session)<=32768),
  expires_at timestamptz not null
);
alter table public.naver_identities enable row level security;
alter table public.naver_login_handoffs enable row level security;
revoke all on public.naver_identities, public.naver_login_handoffs from public, anon, authenticated;
grant select, insert, update, delete on public.naver_identities, public.naver_login_handoffs to service_role;
create index naver_handoffs_expiry on public.naver_login_handoffs(expires_at);
create function public.consume_naver_handoff(p_nonce_hash text)
returns table(sealed_session text) language sql security invoker set search_path=public as $$
  delete from public.naver_login_handoffs where nonce_hash=p_nonce_hash and expires_at>now() returning sealed_session;
$$;
revoke all on function public.consume_naver_handoff(text) from public, anon, authenticated;
grant execute on function public.consume_naver_handoff(text) to service_role;
commit;
