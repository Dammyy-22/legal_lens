-- Audit remediation migration (P0/P1/P2 database & RLS hardening).
-- Apply after database/user_consent_migration.sql. Safe to re-run (idempotent).

-- ============================================================
-- 1. SEC-01: Harden user_documents against direct INSERT & path traversal
-- ============================================================

revoke insert on public.user_documents from authenticated;
drop policy if exists "Owners can register uploaded documents" on public.user_documents;

do $$
begin
    alter table public.user_documents
        add constraint ck_user_documents_storage_path_exact check (
            storage_path = owner_id::text || '/' || id::text || '.' ||
                case mime_type
                    when 'application/pdf' then 'pdf'
                    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
                    else 'txt'
                end
        );
exception
    when duplicate_object then null;
end $$;

create or replace function public.enforce_user_document_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    document_total integer;
begin
    if new.owner_id is null then
        raise exception 'Document owner is required' using errcode = '42501';
    end if;

    if current_user <> 'service_role'
       and (auth.uid() is null or new.owner_id <> auth.uid()) then
        raise exception 'Document owner must match the authenticated user' using errcode = '42501';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
    select count(*)
      into document_total
      from public.user_documents
     where owner_id = new.owner_id;

    if document_total >= 20 then
        raise exception 'Document storage quota exceeded' using errcode = '54000';
    end if;
    return new;
end;
$$;

revoke all on function public.enforce_user_document_quota() from public, anon, authenticated;

-- ============================================================
-- 2. SEC-02 & RAG-01: Bound match_document_chunks and filter status = 'current'
-- ============================================================

create or replace function public.match_document_chunks(
    query_embedding vector(1536),
    match_threshold float default 0.72,
    match_count int default 6
)
returns table (
    id uuid,
    text text,
    similarity float,
    section_label text,
    section_heading text,
    source_title text,
    source_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    if match_threshold < -1 or match_threshold > 1
       or match_count < 1 or match_count > 20 then
        raise exception 'Invalid retrieval parameters' using errcode = '22023';
    end if;

    return query
    select
        dc.id,
        dc.text,
        1 - (dc.embedding <=> query_embedding) as similarity,
        ls.label as section_label,
        ls.heading as section_heading,
        src.title as source_title,
        src.source_url as source_url
    from public.document_chunks dc
    join public.legal_source_versions v on v.id = dc.version_id
    join public.legal_sections ls on ls.id = dc.section_id
    join public.legal_sources src on src.id = v.source_id
    where v.verified = true
      and v.status = 'current'
      and dc.embedding is not null
      and 1 - (dc.embedding <=> query_embedding) > match_threshold
    order by dc.embedding <=> query_embedding
    limit match_count;
end;
$$;

revoke all on function public.match_document_chunks(vector, float, int) from public, anon;
grant execute on function public.match_document_chunks(vector, float, int) to authenticated;

-- ============================================================
-- 3. SEC-04 & FUN-01: Restrict messages to SELECT for users; server writes via service_role
-- ============================================================

drop policy if exists "Users access messages in their own conversations" on public.messages;
drop policy if exists "Users read messages in their own conversations" on public.messages;

revoke insert, update, delete on public.messages from authenticated;
grant select on public.messages to authenticated;
grant all on public.messages to service_role;

create policy "Users read messages in their own conversations"
    on public.messages for select to authenticated
    using (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = auth.uid()
        )
    );

grant select on public.citations to authenticated;
grant all on public.citations to service_role;

-- ============================================================
-- 4. SEC-03: Distributed atomic rate limiter RPC
-- ============================================================

do $$
declare
    con_name text;
begin
    for con_name in
        select c.conname
        from pg_constraint c
        where c.conrelid = 'public.rate_limit_events'::regclass
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) like '%action%'
    loop
        execute format('alter table public.rate_limit_events drop constraint %I', con_name);
    end loop;

    alter table public.rate_limit_events
        add constraint ck_rate_limit_events_action check (
            action in (
                'ask', 'search', 'review', 'draft',
                'document_upload', 'document_process', 'document_ask'
            )
        );
end $$;

create or replace function public.consume_rate_limit(
    p_action text,
    p_max_requests integer,
    p_window_seconds integer
)
returns table (
    allowed boolean,
    remaining integer,
    retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_window_start timestamptz;
    v_count integer;
    v_oldest timestamptz;
begin
    if v_user_id is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    if p_action not in (
        'ask', 'search', 'review', 'draft',
        'document_upload', 'document_process', 'document_ask'
    ) then
        raise exception 'Invalid rate limit action' using errcode = '22023';
    end if;

    if p_max_requests < 1 or p_max_requests > 500
       or p_window_seconds < 1 or p_window_seconds > 86400 then
        raise exception 'Invalid rate limit parameters' using errcode = '22023';
    end if;

    v_window_start := now() - make_interval(secs => p_window_seconds);

    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_action, 0));

    select count(*)::integer, min(e.created_at)
      into v_count, v_oldest
      from public.rate_limit_events e
     where e.user_id = v_user_id
       and e.action = p_action
       and e.created_at >= v_window_start;

    if v_count >= p_max_requests then
        return query select
            false,
            0,
            greatest(
                1,
                ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer
            );
        return;
    end if;

    insert into public.rate_limit_events (user_id, action, window_start, request_count, metadata)
    values (
        v_user_id,
        p_action,
        v_window_start,
        v_count + 1,
        jsonb_build_object('limit', p_max_requests, 'window_seconds', p_window_seconds)
    );

    return query select true, greatest(p_max_requests - v_count - 1, 0), 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- ============================================================
-- 5. ARC-01 & SEC-08: Tighter legal_sources RLS, escaped LIKE, & paginated SQL corpus RPCs
-- ============================================================

drop policy if exists "Verified legal sources are readable by authenticated users" on public.legal_sources;
drop policy if exists "Verified current legal sources are readable" on public.legal_sources;
create policy "Verified current legal sources are readable"
    on public.legal_sources for select to authenticated
    using (
        exists (
            select 1 from public.legal_source_versions v
            where v.source_id = legal_sources.id
              and v.verified = true
              and v.status = 'current'
        )
        or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

create or replace function public.search_verified_document_chunks(
    query_text text,
    match_count integer default 6
)
returns table (
    id uuid,
    text text,
    similarity float,
    section_label text,
    section_heading text,
    source_title text,
    source_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    parsed_query tsquery;
    escaped_like text;
begin
    if query_text is null or length(trim(query_text)) < 2 or length(query_text) > 2000 then
        raise exception 'Invalid legal search query' using errcode = '22023';
    end if;
    if match_count < 1 or match_count > 20 then
        raise exception 'Invalid legal search result limit' using errcode = '22023';
    end if;

    escaped_like := replace(replace(replace(lower(trim(query_text)), '\', '\\'), '%', '\%'), '_', '\_');

    select to_tsquery(
        'english',
        nullif(
            array_to_string(
                tsvector_to_array(
                    to_tsvector(
                        'english',
                        regexp_replace(
                            query_text,
                            '\m(nigeria|nigerian|constitution|constitutional|law|legal)\M',
                            ' ',
                            'gi'
                        )
                    )
                ),
                ' | '
            ),
            ''
        )
    )
    into parsed_query;

    return query
    with ranked_chunks as (
        select
            dc.id,
            dc.text,
            ts_rank_cd(
                setweight(to_tsvector('english', ls.label), 'A') ||
                setweight(to_tsvector('english', coalesce(ls.heading, '')), 'A') ||
                setweight(to_tsvector('english', dc.text), 'B'),
                parsed_query
            )::double precision as rank,
            ls.label as section_label,
            ls.heading as section_heading,
            src.title as source_title,
            src.source_url as source_url
        from public.document_chunks dc
        join public.legal_source_versions v on v.id = dc.version_id
        join public.legal_sections ls on ls.id = dc.section_id
        join public.legal_sources src on src.id = v.source_id
        where v.verified = true
          and v.status = 'current'
          and (
              (
                  parsed_query is not null
                  and (
                      setweight(to_tsvector('english', ls.label), 'A') ||
                      setweight(to_tsvector('english', coalesce(ls.heading, '')), 'A') ||
                      setweight(to_tsvector('english', dc.text), 'B')
                  ) @@ parsed_query
              )
              or lower(dc.text) like '%' || escaped_like || '%' escape '\'
          )
    )
    select
        ranked_chunks.id,
        ranked_chunks.text,
        ranked_chunks.rank,
        ranked_chunks.section_label,
        ranked_chunks.section_heading,
        ranked_chunks.source_title,
        ranked_chunks.source_url
    from ranked_chunks
    order by ranked_chunks.rank desc, ranked_chunks.id
    limit match_count;
end;
$$;

revoke all on function public.search_verified_document_chunks(text, integer) from public, anon;
grant execute on function public.search_verified_document_chunks(text, integer) to authenticated;

create or replace function public.search_legal_corpus(
    p_query text,
    p_jurisdiction text default null,
    p_document_type text default null,
    p_authority_level text default null,
    p_limit integer default 20,
    p_offset integer default 0
)
returns table (
    chunk_id uuid,
    source_id uuid,
    version_id uuid,
    source_title text,
    source_url text,
    jurisdiction text,
    document_type text,
    authority_level text,
    version_label text,
    section_label text,
    section_heading text,
    status text,
    effective_date date,
    text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_tsquery tsquery;
    v_like text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;
    if p_query is null or length(trim(p_query)) < 2 or length(p_query) > 500 then
        raise exception 'Invalid search query' using errcode = '22023';
    end if;
    if p_limit < 1 or p_limit > 50 or p_offset < 0 then
        raise exception 'Invalid pagination bounds' using errcode = '22023';
    end if;

    v_tsquery := websearch_to_tsquery('english', trim(p_query));
    v_like := replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_');

    return query
    select
        dc.id as chunk_id,
        src.id as source_id,
        v.id as version_id,
        src.title as source_title,
        src.source_url,
        src.jurisdiction,
        src.document_type,
        src.authority_level,
        v.version_label,
        ls.label as section_label,
        ls.heading as section_heading,
        v.status,
        v.effective_date,
        dc.text
    from public.document_chunks dc
    join public.legal_source_versions v on v.id = dc.version_id
    join public.legal_sections ls on ls.id = dc.section_id
    join public.legal_sources src on src.id = v.source_id
    where v.verified = true
      and v.status = 'current'
      and (p_jurisdiction is null or lower(src.jurisdiction) = lower(trim(p_jurisdiction)))
      and (p_document_type is null or src.document_type = p_document_type)
      and (p_authority_level is null or src.authority_level = p_authority_level)
      and (
          (
              v_tsquery is not null
              and (
                  setweight(to_tsvector('english', src.title), 'A') ||
                  setweight(to_tsvector('english', ls.label), 'A') ||
                  setweight(to_tsvector('english', coalesce(ls.heading, '')), 'A') ||
                  setweight(to_tsvector('english', dc.text), 'B')
              ) @@ v_tsquery
          )
          or lower(dc.text) like '%' || v_like || '%' escape '\'
          or lower(src.title) like '%' || v_like || '%' escape '\'
      )
    order by
        ts_rank_cd(
            setweight(to_tsvector('english', src.title), 'A') ||
            setweight(to_tsvector('english', ls.label), 'A') ||
            setweight(to_tsvector('english', coalesce(ls.heading, '')), 'A') ||
            setweight(to_tsvector('english', dc.text), 'B'),
            coalesce(v_tsquery, to_tsquery('english', ''))
        ) desc,
        ls.order_index asc,
        dc.chunk_index asc
    limit p_limit
    offset p_offset;
end;
$$;

revoke all on function public.search_legal_corpus(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.search_legal_corpus(text, text, text, text, integer, integer) to authenticated;

create or replace function public.get_verified_constitution()
returns table (
    chunk_id uuid,
    source_id uuid,
    version_id uuid,
    source_title text,
    source_url text,
    jurisdiction text,
    document_type text,
    authority_level text,
    version_label text,
    section_label text,
    section_heading text,
    status text,
    effective_date date,
    text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    return query
    select
        dc.id as chunk_id,
        src.id as source_id,
        v.id as version_id,
        src.title as source_title,
        src.source_url,
        src.jurisdiction,
        src.document_type,
        src.authority_level,
        v.version_label,
        ls.label as section_label,
        ls.heading as section_heading,
        v.status,
        v.effective_date,
        dc.text
    from public.document_chunks dc
    join public.legal_source_versions v on v.id = dc.version_id
    join public.legal_sections ls on ls.id = dc.section_id
    join public.legal_sources src on src.id = v.source_id
    where v.verified = true
      and v.status = 'current'
      and (src.document_type = 'constitution' or lower(src.title) like '%constitution%')
    order by ls.order_index asc, dc.chunk_index asc;
end;
$$;

revoke all on function public.get_verified_constitution() from public, anon;
grant execute on function public.get_verified_constitution() to authenticated;

-- ============================================================
-- 6. DB-01 & DB-02: Missing B-Tree, GIN, and HNSW Vector Indexes
-- ============================================================

create index if not exists idx_document_chunks_version_id
    on public.document_chunks (version_id);
create index if not exists idx_document_chunks_section_id
    on public.document_chunks (section_id);
create index if not exists idx_document_chunks_text_gin
    on public.document_chunks using gin (to_tsvector('english', text));
create index if not exists idx_legal_sections_version_order
    on public.legal_sections (version_id, order_index);
create index if not exists idx_conversations_user_updated
    on public.conversations (user_id, updated_at desc);
create index if not exists idx_messages_conversation_created
    on public.messages (conversation_id, created_at);
create index if not exists idx_citations_message_id
    on public.citations (message_id);
create index if not exists idx_rate_limit_events_lookup
    on public.rate_limit_events (user_id, action, created_at desc);
create index if not exists idx_user_documents_owner_created
    on public.user_documents (owner_id, created_at desc);
create index if not exists idx_user_document_questions_doc_owner
    on public.user_document_questions (document_id, owner_id, created_at desc);

drop index if exists public.idx_document_chunks_embedding;
create index if not exists idx_document_chunks_embedding_hnsw
    on public.document_chunks using hnsw (embedding vector_cosine_ops);

drop index if exists public.idx_user_document_chunks_embedding;
create index if not exists idx_user_document_chunks_embedding_hnsw
    on public.user_document_chunks using hnsw (embedding vector_cosine_ops);
