-- Phase 1 AI provider hardening, consent alignment, embedding tracking, and token usage telemetry.
-- Apply after database/audit_hardening_migration.sql. Safe to re-run (idempotent).

-- ============================================================
-- 1. Expand user_consent_events purposes to include legal_qa
-- ============================================================

do $$
declare
    con_name text;
begin
    for con_name in
        select c.conname
        from pg_constraint c
        where c.conrelid = 'public.user_consent_events'::regclass
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) like '%purpose%'
    loop
        execute format('alter table public.user_consent_events drop constraint %I', con_name);
    end loop;

    alter table public.user_consent_events
        add constraint ck_user_consent_events_purpose check (
            purpose in ('private_document_processing', 'drafting_assistance', 'legal_qa')
        );
end $$;

-- ============================================================
-- 2. Track embedding_model on corpus & private document chunks
-- ============================================================

alter table public.document_chunks
    add column if not exists embedding_model text not null default 'openai/text-embedding-3-small';

alter table public.user_document_chunks
    add column if not exists embedding_model text not null default 'openai/text-embedding-3-small';

-- ============================================================
-- 3. AI usage telemetry table & daily per-user token budget RPCs
-- ============================================================

create table if not exists public.ai_usage_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    feature text not null check (
        feature in ('ask', 'ask_user_document', 'draft_document', 'process_user_document')
    ),
    provider text not null check (length(provider) between 1 and 64),
    model text not null check (length(model) between 1 and 128),
    prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
    completion_tokens integer not null default 0 check (completion_tokens >= 0),
    total_tokens integer not null default 0 check (total_tokens >= 0),
    status text not null default 'ok' check (status in ('ok', 'error', 'blocked')),
    fallback_used boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_user_created
    on public.ai_usage_events (user_id, created_at desc);

alter table public.ai_usage_events enable row level security;

revoke all on public.ai_usage_events from public, anon, authenticated;
grant select on public.ai_usage_events to authenticated;
grant all on public.ai_usage_events to service_role;

drop policy if exists "Users read their own AI usage events" on public.ai_usage_events;
create policy "Users read their own AI usage events"
    on public.ai_usage_events
    for select
    to authenticated
    using (user_id = auth.uid());

create or replace function public.check_ai_token_budget(
    p_daily_limit integer default 100000
)
returns table (
    allowed boolean,
    used_tokens integer,
    remaining_tokens integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
    v_used integer;
begin
    if v_user_id is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    if p_daily_limit < 1000 or p_daily_limit > 10000000 then
        raise exception 'Invalid daily token budget' using errcode = '22023';
    end if;

    select coalesce(sum(e.total_tokens), 0)::integer
      into v_used
      from public.ai_usage_events e
     where e.user_id = v_user_id
       and e.created_at >= v_day_start;

    return query select
        v_used < p_daily_limit,
        v_used,
        greatest(p_daily_limit - v_used, 0);
end;
$$;

revoke all on function public.check_ai_token_budget(integer) from public, anon;
grant execute on function public.check_ai_token_budget(integer) to authenticated;

create or replace function public.record_ai_usage(
    p_feature text,
    p_provider text,
    p_model text,
    p_prompt_tokens integer default 0,
    p_completion_tokens integer default 0,
    p_total_tokens integer default 0,
    p_status text default 'ok',
    p_fallback_used boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_prompt integer := greatest(coalesce(p_prompt_tokens, 0), 0);
    v_completion integer := greatest(coalesce(p_completion_tokens, 0), 0);
    v_total integer := greatest(coalesce(p_total_tokens, v_prompt + v_completion), 0);
begin
    if v_user_id is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    if p_feature not in ('ask', 'ask_user_document', 'draft_document', 'process_user_document') then
        raise exception 'Invalid AI feature' using errcode = '22023';
    end if;

    if p_status not in ('ok', 'error', 'blocked') then
        raise exception 'Invalid AI usage status' using errcode = '22023';
    end if;

    if p_provider is null or length(trim(p_provider)) not between 1 and 64 then
        raise exception 'Invalid AI provider' using errcode = '22023';
    end if;

    if p_model is null or length(trim(p_model)) not between 1 and 128 then
        raise exception 'Invalid AI model' using errcode = '22023';
    end if;

    if v_prompt > 1000000 or v_completion > 1000000 or v_total > 1000000 then
        raise exception 'Token counts out of bounds' using errcode = '22023';
    end if;

    insert into public.ai_usage_events (
        user_id,
        feature,
        provider,
        model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        status,
        fallback_used
    )
    values (
        v_user_id,
        p_feature,
        trim(p_provider),
        trim(p_model),
        v_prompt,
        v_completion,
        v_total,
        p_status,
        coalesce(p_fallback_used, false)
    );
end;
$$;

revoke all on function public.record_ai_usage(text, text, text, integer, integer, integer, text, boolean) from public, anon;
grant execute on function public.record_ai_usage(text, text, text, integer, integer, integer, text, boolean) to authenticated;

-- ============================================================
-- 4. SEC-10: Enforce server-derived verified_by / verified_at audit fields
-- ============================================================

create or replace function public.enforce_legal_source_version_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.verified is true and coalesce(old.verified, false) is false then
        if auth.uid() is not null then
            new.verified_by := auth.uid()::text;
        end if;
        new.verified_at := now();
    elsif new.verified is false and coalesce(old.verified, false) is true then
        new.verified_by := null;
        new.verified_at := null;
    end if;

    if new.status is distinct from old.status and new.status in ('current', 'rejected', 'superseded', 'amended', 'repealed') then
        if auth.uid() is not null then
            new.reviewed_by := auth.uid()::text;
        end if;
        new.reviewed_at := now();
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_legal_source_version_audit on public.legal_source_versions;
create trigger trg_enforce_legal_source_version_audit
    before update on public.legal_source_versions
    for each row
    execute function public.enforce_legal_source_version_audit();
