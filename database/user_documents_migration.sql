-- Private user-document upload and Q&A migration.
-- Apply after database/schema.sql. Safe to re-run.

create table if not exists public.user_documents (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    original_filename text not null check (char_length(original_filename) between 1 and 255),
    storage_path text not null unique,
    mime_type text not null check (mime_type in (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    )),
    file_size_bytes bigint not null check (file_size_bytes between 1 and 15728640),
    processing_status text not null default 'uploaded' check (processing_status in (
        'uploaded', 'processing', 'ready', 'failed'
    )),
    processing_error text,
    page_count integer check (page_count is null or page_count >= 0),
    character_count integer check (character_count is null or character_count >= 0),
    checksum_sha256 text,
    created_at timestamptz not null default now(),
    unique (id, owner_id)
);

create or replace function public.enforce_user_document_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    document_total integer;
begin
    if auth.uid() is null or new.owner_id <> auth.uid() then
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
drop trigger if exists enforce_user_document_quota_before_insert on public.user_documents;
create trigger enforce_user_document_quota_before_insert
    before insert on public.user_documents
    for each row execute function public.enforce_user_document_quota();

create table if not exists public.user_document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null,
    owner_id uuid not null,
    chunk_index integer not null check (chunk_index >= 0),
    page_number integer check (page_number is null or page_number > 0),
    text text not null,
    embedding vector(1536) not null,
    created_at timestamptz not null default now(),
    foreign key (document_id, owner_id)
        references public.user_documents(id, owner_id) on delete cascade,
    unique (id, document_id, owner_id),
    unique (document_id, chunk_index)
);

create index if not exists idx_user_document_chunks_embedding
    on public.user_document_chunks using ivfflat (embedding vector_cosine_ops)
    with (lists = 50);

create table if not exists public.user_document_questions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null,
    owner_id uuid not null,
    question text not null check (char_length(question) between 3 and 2000),
    answer text not null,
    is_uncertain boolean not null default false,
    created_at timestamptz not null default now(),
    foreign key (document_id, owner_id)
        references public.user_documents(id, owner_id) on delete cascade,
    unique (id, document_id, owner_id)
);

create table if not exists public.user_document_answer_sources (
    question_id uuid not null,
    chunk_id uuid not null,
    document_id uuid not null,
    owner_id uuid not null,
    created_at timestamptz not null default now(),
    primary key (question_id, chunk_id),
    foreign key (question_id, document_id, owner_id)
        references public.user_document_questions(id, document_id, owner_id) on delete cascade,
    foreign key (chunk_id, document_id, owner_id)
        references public.user_document_chunks(id, document_id, owner_id) on delete cascade
);

alter table public.user_documents enable row level security;
alter table public.user_document_chunks enable row level security;
alter table public.user_document_questions enable row level security;
alter table public.user_document_answer_sources enable row level security;

revoke all on public.user_documents,
    public.user_document_chunks,
    public.user_document_questions,
    public.user_document_answer_sources from anon, authenticated;
grant select, insert, delete on public.user_documents to authenticated;
grant select on public.user_document_chunks to authenticated;
grant select on public.user_document_questions to authenticated;
grant select on public.user_document_answer_sources to authenticated;
grant all on public.user_documents,
    public.user_document_chunks,
    public.user_document_questions,
    public.user_document_answer_sources to service_role;

drop policy if exists "Owners can read their document metadata" on public.user_documents;
create policy "Owners can read their document metadata"
    on public.user_documents for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "Owners can register uploaded documents" on public.user_documents;
create policy "Owners can register uploaded documents"
    on public.user_documents for insert to authenticated
    with check (auth.uid() = owner_id and processing_status = 'uploaded');

drop policy if exists "Owners can delete their documents" on public.user_documents;
create policy "Owners can delete their documents"
    on public.user_documents for delete to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "Owners can read their document chunks" on public.user_document_chunks;
create policy "Owners can read their document chunks"
    on public.user_document_chunks for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "Owners can read their document questions" on public.user_document_questions;
create policy "Owners can read their document questions"
    on public.user_document_questions for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "Owners can create questions for their documents" on public.user_document_questions;

drop policy if exists "Owners can read their document answer sources" on public.user_document_answer_sources;
create policy "Owners can read their document answer sources"
    on public.user_document_answer_sources for select to authenticated
    using (auth.uid() = owner_id);

drop policy if exists "Owners can attach sources to their document questions" on public.user_document_answer_sources;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'user-documents',
    'user-documents',
    false,
    15728640,
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ]
)
on conflict (id) do update set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload objects to their own document folder" on storage.objects;
drop policy if exists "Users read objects in their own document folder" on storage.objects;
create policy "Users read objects in their own document folder"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'user-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "Users delete objects in their own document folder" on storage.objects;
create policy "Users delete objects in their own document folder"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'user-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create or replace function public.match_user_document_chunks(
    query_embedding vector(1536),
    p_document_id uuid,
    match_threshold float default 0.55,
    match_count int default 6
)
returns table (
    id uuid,
    text text,
    similarity float,
    page_number integer,
    chunk_index integer
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
       or match_count < 1 or match_count > 10 then
        raise exception 'Invalid retrieval parameters' using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.user_documents d
        where d.id = p_document_id
          and d.owner_id = auth.uid()
          and d.processing_status = 'ready'
    ) then
        raise exception 'Document not found or not ready' using errcode = '42501';
    end if;

    return query
    select
        c.id,
        c.text,
        1 - (c.embedding <=> query_embedding) as similarity,
        c.page_number,
        c.chunk_index
    from public.user_document_chunks c
    where c.document_id = p_document_id
      and c.owner_id = auth.uid()
      and 1 - (c.embedding <=> query_embedding) > match_threshold
    order by c.embedding <=> query_embedding
    limit match_count;
end;
$$;

revoke all on function public.match_user_document_chunks(vector, uuid, float, int) from public;
grant execute on function public.match_user_document_chunks(vector, uuid, float, int) to authenticated;
