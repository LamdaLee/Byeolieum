-- Local test after bootstrap + migration. Fixtures and writes are rolled back.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select revision from public.save_idea_space(0,'{"version":1,"project":{},"library":{}}');
select revision from public.save_idea_space(1,'{"version":1,"project":{},"library":{}}');
do $$ begin
 if (select revision from public.idea_spaces) <> 2 then raise exception 'Own save failed'; end if;
 begin
  perform public.save_idea_space(1,'{"version":1,"project":{},"library":{}}');
  raise exception 'Stale update was accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.save_idea_space(0,'{"version":1,"project":{},"library":{}}');
  raise exception 'Duplicate first write was accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.save_idea_space(2,'{"version":1}');
  raise exception 'Malformed document was accepted';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from public.idea_spaces) then raise exception 'Other account was readable'; end if;
 update public.idea_spaces set revision=9 where user_id='11111111-1111-4111-8111-111111111111';
 if found then raise exception 'Other account was writable'; end if;
 begin
  insert into public.idea_spaces(user_id,document) values('11111111-1111-4111-8111-111111111111','{"version":1,"project":{},"library":{}}');
  raise exception 'Other account insert was accepted';
 exception when insufficient_privilege then null; end;
end $$;
select revision from public.save_idea_space(0,'{"version":1,"project":{},"library":{}}');
do $$ begin
 if (select count(*) from public.idea_spaces) <> 1 then raise exception 'Own account isolation failed'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
  perform public.save_idea_space(0,'{"version":1,"project":{},"library":{}}');
  raise exception 'Anonymous save was accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.idea_spaces) <> 2 then raise exception 'Unexpected record count'; end if;
end $$;
rollback;
