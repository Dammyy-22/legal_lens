-- Two-user authorization tests for user_consent_events (run in CI; ON_ERROR_STOP).
-- Uses the Supabase-style JWT claim setting that auth.uid() reads.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.test');

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
end $$;

create or replace function pg_temp.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return;
  end;
  raise exception 'EXPECTED ERROR BUT SUCCEEDED: %', label;
end $$;

create or replace function pg_temp.assert_true(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if;
end $$;


-- ---------- Alice ----------
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

select pg_temp.assert_true(not public.has_current_consent('private_document_processing', 'v1'), 'no consent before granting');
select public.grant_consent('private_document_processing', 'v1');
select pg_temp.assert_true(public.has_current_consent('private_document_processing', 'v1'), 'granted v1 is current');
select pg_temp.assert_true(not public.has_current_consent('private_document_processing', 'v2'), 'older version is not current for v2');
select pg_temp.assert_true(not public.has_current_consent('drafting_assistance', 'v1'), 'purposes are independent');

select public.withdraw_consent('private_document_processing');
select pg_temp.assert_true(not public.has_current_consent('private_document_processing', 'v1'), 'withdrawn consent is not current');
select public.grant_consent('private_document_processing', 'v1');
select pg_temp.assert_true(public.has_current_consent('private_document_processing', 'v1'), 're-grant works');

-- Direct writes are refused
select pg_temp.expect_error($$insert into public.user_consent_events (user_id, purpose, action, policy_version) values ('00000000-0000-0000-0000-0000000000a1','drafting_assistance','granted','v1')$$, 'direct insert');
select pg_temp.expect_error($$update public.user_consent_events set action = 'granted'$$, 'direct update');
select pg_temp.expect_error($$delete from public.user_consent_events$$, 'direct delete');
-- Invalid purpose is refused
select pg_temp.expect_error($$select public.grant_consent('anything_else', 'v1')$$, 'invalid purpose');

select pg_temp.assert_true((select count(*) from public.user_consent_events) = 3, 'alice sees exactly her 3 events');

-- ---------- Bob must not see or inherit Alice''s consent ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.assert_true((select count(*) from public.user_consent_events) = 0, 'bob sees none of alice''s events');
select pg_temp.assert_true(not public.has_current_consent('private_document_processing', 'v1'), 'bob has no consent');
select public.withdraw_consent('private_document_processing');  -- bob withdrawing must not affect alice
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.assert_true(public.has_current_consent('private_document_processing', 'v1'), 'alice unaffected by bob');

-- ---------- Unauthenticated ----------
select pg_temp.as_user('');
select pg_temp.expect_error($$select public.grant_consent('drafting_assistance', 'v1')$$, 'grant without auth');
select pg_temp.assert_true(not public.has_current_consent('private_document_processing', 'v1'), 'no auth => no consent');

-- ---------- anon role has no access ----------
reset role;
set local role anon;
select pg_temp.expect_error($$select public.grant_consent('drafting_assistance', 'v1')$$, 'anon grant');
select pg_temp.expect_error($$select * from public.user_consent_events$$, 'anon select');

rollback;
\echo user_consent_test: all assertions passed
