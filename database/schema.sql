-- LegalLens Supabase schema — legal corpus + AI assistant tables.
-- Run this in Supabase Dashboard → SQL Editor. Idempotent (safe to re-run).
--
-- Design principles carried over from the original FastAPI/Alembic schema
-- (see apps/api/DATABASE.md for the fuller rationale, now retired but still useful
-- reference):
--   - Authoritative legal sources are a SEPARATE table family from user-uploaded
--     documents. Never conflate the two.
--   - Nothing is "verified" or citable until a human flips a boolean — ingestion
--     populates data, it does not publish it.
--   - Citations must reference a real chunk row — enforced by a CHECK constraint,
--     not just application logic.

create extension if not exists vector;
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ============================================================
-- Authoritative legal corpus
-- ============================================================

create table if not exists public.legal_sources (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    jurisdiction text not null default 'Nigeria',
    country text not null default 'Nigeria',
    issuing_authority text not null,
    document_type text not null check (document_type in (
        'constitution', 'legislation', 'regulation', 'case_law',
        'agency_guidance', 'secondary_commentary'
    )),
    authority_level text not null check (authority_level in (
        'primary', 'institutional', 'secondary'
    )),
    language text not null default 'en',
    source_url text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.legal_source_versions (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.legal_sources(id) on delete cascade,
    version_label text not null,
    publication_date date,
    effective_date date,
    amendment_date date,
    status text not null default 'unverified' check (status in (
        'current', 'amended', 'repealed', 'superseded', 'unverified'
    )),
    superseded_by_version_id uuid references public.legal_source_versions(id),
    processing_status text not null default 'pending' check (processing_status in (
        'pending', 'extracted', 'chunked', 'embedded', 'indexed', 'published', 'failed'
    )),
    original_object_key text,
    checksum_sha256 text,
    retrieved_at timestamptz,
    verified boolean not null default false,
    verified_by text,
    verified_at timestamptz,
    created_at timestamptz not null default now(),
    unique (source_id, version_label)
);

-- Chapter-level granularity for this first ingestion pass — see DECISIONS.md for why
-- section-level parsing was deliberately deferred (Chapter IV's extracted text lost
-- its section-number prefixes; shipping fragile regex-based section splitting would
-- have silently mis-chunked exactly the most-queried chapter).
create table if not exists public.legal_sections (
    id uuid primary key default gen_random_uuid(),
    version_id uuid not null references public.legal_source_versions(id) on delete cascade,
    parent_section_id uuid references public.legal_sections(id) on delete cascade,
    hierarchy_level text not null default 'chapter' check (hierarchy_level in (
        'part', 'chapter', 'division', 'section', 'subsection', 'paragraph', 'schedule'
    )),
    label text not null,
    heading text,
    order_index integer not null default 0,
    page_number integer,
    text text not null
);

create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.legal_sections(id) on delete cascade,
    version_id uuid not null references public.legal_source_versions(id) on delete cascade,
    chunk_index integer not null default 0,
    text text not null,
    embedding vector(1536), -- matches OpenAI text-embedding-3-small; see DECISIONS.md
    created_at timestamptz not null default now()
);

create index if not exists idx_document_chunks_embedding
    on public.document_chunks using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

-- ============================================================
-- Conversations, messages, citations (AI assistant)
-- ============================================================

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text,
    jurisdiction text not null default 'Nigeria',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    role text not null check (role in ('user', 'assistant', 'system')),
    content text not null,
    risk_level text not null default 'standard' check (risk_level in ('standard', 'high_risk')),
    is_uncertain boolean not null default false,
    created_at timestamptz not null default now()
);

-- A citation must reference a real chunk — enforced here, not just in application
-- code. Matches the same invariant proven out in the earlier FastAPI schema.
create table if not exists public.citations (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.messages(id) on delete cascade,
    chunk_id uuid references public.document_chunks(id) on delete cascade,
    quoted_text text,
    created_at timestamptz not null default now(),
    constraint ck_citation_has_source check (chunk_id is not null)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.legal_sources enable row level security;
alter table public.legal_source_versions enable row level security;
alter table public.legal_sections enable row level security;
alter table public.document_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.citations enable row level security;

-- Legal corpus: readable by any authenticated user, but ONLY for verified content.
-- Unverified/unpublished ingestion data is invisible to the app entirely — this is
-- the enforcement point for "nothing is citable until a human verifies it."
create policy "Verified legal sources are readable by authenticated users"
    on public.legal_sources for select to authenticated using (true);

create policy "Only verified versions are readable"
    on public.legal_source_versions for select to authenticated
    using (verified = true);

create policy "Sections of verified versions are readable"
    on public.legal_sections for select to authenticated
    using (
        exists (
            select 1 from public.legal_source_versions v
            where v.id = version_id and v.verified = true
        )
    );

create policy "Chunks of verified versions are readable"
    on public.document_chunks for select to authenticated
    using (
        exists (
            select 1 from public.legal_source_versions v
            where v.id = version_id and v.verified = true
        )
    );

-- No insert/update/delete policies exist for the legal corpus tables above, which
-- means, under RLS, ordinary authenticated users cannot write to them at all — only
-- the service_role key (used server-side by the ingestion script and future admin
-- tools) bypasses RLS and can write. This is intentional: the corpus is
-- admin-curated, never user-editable.

-- Conversations/messages/citations: users can only access their own.
create policy "Users manage their own conversations"
    on public.conversations for all to authenticated
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users access messages in their own conversations"
    on public.messages for all to authenticated
    using (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id and c.user_id = auth.uid()
        )
    );

create policy "Users access citations on their own messages"
    on public.citations for select to authenticated
    using (
        exists (
            select 1 from public.messages m
            join public.conversations c on c.id = m.conversation_id
            where m.id = message_id and c.user_id = auth.uid()
        )
    );
