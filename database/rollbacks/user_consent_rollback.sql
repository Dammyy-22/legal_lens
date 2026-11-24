-- Rolls back database/user_consent_migration.sql. DESTROYS the consent audit log.
-- Export it first if you need it:  \copy public.user_consent_events to 'consent_events.csv' csv header
drop function if exists public.has_current_consent(text, text);
drop function if exists public.withdraw_consent(text);
drop function if exists public.grant_consent(text, text);
drop table if exists public.user_consent_events;
