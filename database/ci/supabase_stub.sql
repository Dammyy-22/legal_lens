-- Stubs for Supabase-managed schemas/roles so migrations can run on plain Postgres in CI.
-- Real Supabase provides these built in. Do NOT apply to a real Supabase project.
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$ language sql stable;
create or replace function auth.jwt() returns jsonb as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$ language sql stable;
create schema if not exists storage;
create role anon;
create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
);
create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text not null references storage.buckets(id),
    name text not null
);
create or replace function storage.foldername(object_name text) returns text[] as $$
    select (string_to_array(object_name, '/'))[1:greatest(array_length(string_to_array(object_name, '/'), 1) - 1, 0)]
$$ language sql immutable;
create role authenticated;
create role service_role bypassrls;
grant usage on schema public to authenticated;
grant usage on schema auth to authenticated, service_role;
grant usage on schema storage to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
alter table storage.objects enable row level security;
