-- Server-side record of user consent to AI processing (issue LL-020).
--
-- Append-only event log: consent is whatever the user's LATEST event (highest seq)
-- for a purpose says. Users can read their own events; they can write ONLY through
-- grant_consent / withdraw_consent. Re-runnable. Rollback:
-- database/rollbacks/user_consent_rollback.sql
--
-- Purposes:
--   private_document_processing  uploading/indexing/asking about a private document
--   drafting_assistance          sending a user's description to the drafting model

create table if not exists public.user_consent_events (
    id uuid primary key default gen_random_uuid(),
    -- Monotonic ordering key: timestamps can tie within one transaction, so the
    -- "latest event" is decided by seq, never by created_at.
    seq bigint generated always as identity,
    user_id uuid not null references auth.users(id) on delete cascade,
    purpose text not null check (purpose in ('private_document_processing', 'drafting_assistance')),
    action text not null check (action in ('granted', 'withdrawn')),
    policy_version text not null check (length(policy_version) between 1 and 64),
    created_at timestamptz not null default now()
);

create index if not exists user_consent_events_latest_idx
    on public.user_consent_events (user_id, purpose, seq desc);

alter table public.user_consent_events enable row level security;

revoke all on public.user_consent_events from public, anon, authenticated;
grant select on public.user_consent_events to authenticated;
grant all on public.user_consent_events to service_role;

drop policy if exists "Users read their own consent events" on public.user_consent_events;
create policy "Users read their own consent events"
    on public.user_consent_events
    for select
    to authenticated
    using (user_id = auth.uid());
-- No insert/update/delete policies: events are written only by the functions below
-- and can never be edited or removed by the user (audit integrity).

create or replace function public.grant_consent(p_purpose text, p_policy_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication required' using errcode = '28000';
    end if;
    insert into public.user_consent_events (user_id, purpose, action, policy_version)
    values (auth.uid(), p_purpose, 'granted', p_policy_version);
end;
$$;

create or replace function public.withdraw_consent(p_purpose text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_version text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required' using errcode = '28000';
    end if;
    select policy_version into v_version
    from public.user_consent_events
    where user_id = auth.uid() and purpose = p_purpose
    order by seq desc
    limit 1;
    insert into public.user_consent_events (user_id, purpose, action, policy_version)
    values (auth.uid(), p_purpose, 'withdrawn', coalesce(v_version, 'none'));
end;
$$;

-- True only if the caller's latest event for the purpose is a grant of exactly
-- the required policy version. Runs as the caller, so RLS limits it to their rows.
create or replace function public.has_current_consent(p_purpose text, p_policy_version text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
    select coalesce((
        select e.action = 'granted' and e.policy_version = p_policy_version
        from public.user_consent_events e
        where e.user_id = auth.uid() and e.purpose = p_purpose
        order by e.seq desc
        limit 1
    ), false)
$$;

revoke all on function public.grant_consent(text, text) from public, anon;
revoke all on function public.withdraw_consent(text) from public, anon;
revoke all on function public.has_current_consent(text, text) from public, anon;
grant execute on function public.grant_consent(text, text) to authenticated;
grant execute on function public.withdraw_consent(text) to authenticated;
grant execute on function public.has_current_consent(text, text) to authenticated;
