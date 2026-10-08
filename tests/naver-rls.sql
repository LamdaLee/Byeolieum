begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');
set local role service_role;
insert into public.naver_identities values(repeat('a',64),'11111111-1111-4111-8111-111111111111');
insert into public.naver_login_handoffs values(repeat('b',64),'encrypted-fixture',now()+interval '60 seconds'),(repeat('c',64),'expired-fixture',now()-interval '1 second');
do $$ begin
  if (select count(*) from public.consume_naver_handoff(repeat('b',64)))<>1 then raise exception 'first consume failed'; end if;
  if (select count(*) from public.consume_naver_handoff(repeat('b',64)))<>0 then raise exception 'replay accepted'; end if;
  if (select count(*) from public.consume_naver_handoff(repeat('c',64)))<>0 then raise exception 'expired accepted'; end if;
end $$;
set local role authenticated;
do $$ begin
  begin perform * from public.naver_identities; raise exception 'private identities exposed'; exception when insufficient_privilege then null; end;
  begin perform * from public.naver_login_handoffs; raise exception 'sessions exposed'; exception when insufficient_privilege then null; end;
  begin perform * from public.consume_naver_handoff(repeat('c',64)); raise exception 'private RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform * from public.naver_identities; raise exception 'anonymous identities exposed'; exception when insufficient_privilege then null; end;
  begin perform * from public.consume_naver_handoff(repeat('c',64)); raise exception 'anonymous RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
