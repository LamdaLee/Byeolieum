-- Ephemeral PostgreSQL test container only. Never run against a Supabase project.
create role authenticated;
create role anon;
create role service_role bypassrls;
grant usage on schema public to service_role;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
