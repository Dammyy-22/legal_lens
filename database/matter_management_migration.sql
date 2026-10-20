-- Private user-owned matter tracker and user-entered task dates.
-- Apply after database/user_documents_migration.sql. Safe to re-run.

create table if not exists public.legal_matters (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 120),
    practice_area text not null check (char_length(practice_area) between 1 and 80),
    jurisdiction text not null default 'Nigeria' check (char_length(jurisdiction) between 1 and 100),
    status text not null default 'open' check (status in ('open', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, owner_id)
);

create table if not exists public.legal_matter_tasks (
    id uuid primary key default gen_random_uuid(),
    matter_id uuid not null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) between 1 and 160),
    due_date date,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    foreign key (matter_id, owner_id)
        references public.legal_matters(id, owner_id) on delete cascade
);

create index if not exists idx_legal_matters_owner_created
    on public.legal_matters(owner_id, status, created_at desc);
create index if not exists idx_legal_matter_tasks_owner_due
    on public.legal_matter_tasks(owner_id, due_date)
    where completed_at is null;

alter table public.legal_matters enable row level security;
alter table public.legal_matter_tasks enable row level security;

revoke all on public.legal_matters, public.legal_matter_tasks from anon, authenticated;
grant select, insert, update, delete on public.legal_matters to authenticated;
grant select, insert, update, delete on public.legal_matter_tasks to authenticated;

drop policy if exists "Owners manage their legal matters" on public.legal_matters;
create policy "Owners manage their legal matters"
    on public.legal_matters for all to authenticated
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

drop policy if exists "Owners manage tasks in their legal matters" on public.legal_matter_tasks;
create policy "Owners manage tasks in their legal matters"
    on public.legal_matter_tasks for all to authenticated
    using (
        auth.uid() = owner_id
        and exists (
            select 1 from public.legal_matters m
            where m.id = matter_id and m.owner_id = legal_matter_tasks.owner_id
        )
    )
    with check (
        auth.uid() = owner_id
        and exists (
            select 1 from public.legal_matters m
            where m.id = matter_id and m.owner_id = legal_matter_tasks.owner_id
        )
    );
