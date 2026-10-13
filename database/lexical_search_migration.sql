-- Verified/current-only full-text retrieval used by ask when semantic embeddings
-- are unavailable or return no relevant chunks.
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
begin
    if query_text is null or length(trim(query_text)) < 2 or length(query_text) > 2000 then
        raise exception 'Invalid legal search query' using errcode = '22023';
    end if;
    if match_count < 1 or match_count > 20 then
        raise exception 'Invalid legal search result limit' using errcode = '22023';
    end if;

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
              or lower(dc.text) like '%' || lower(trim(query_text)) || '%'
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
