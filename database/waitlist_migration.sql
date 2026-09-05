-- Run this in Supabase Dashboard → SQL Editor. Creates the table the Lawyers page's
-- waitlist signup writes to, with Row Level Security so users can only insert their
-- own signup and never read anyone else's.

create table if not exists public.lawyer_waitlist (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    email text not null,
    practice_area text,
    created_at timestamptz not null default now()
);

alter table public.lawyer_waitlist enable row level security;

-- Authenticated users may insert a row for themselves only.
create policy "Users can join the waitlist for themselves"
    on public.lawyer_waitlist
    for insert
    to authenticated
    with check (auth.uid() = user_id);

-- No select/update/delete policies are defined, which means, under RLS, ordinary
-- authenticated users cannot read back waitlist entries (including their own) or
-- anyone else's — by design, this is a write-only signup box from the client's
-- perspective. Read access for administrative review should go through the
-- service_role key from a trusted server context, never the browser.
