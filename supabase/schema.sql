-- MasterClass Executive Cohort Map — database schema.
-- Safe to re-run. Apply with the Supabase SQL editor or the management API.

create extension if not exists vector with schema extensions;

create table if not exists public.members (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  phone         text,
  -- location (city-level only, never a street address)
  city          text,
  region        text,
  country       text,
  lat           double precision,
  lng           double precision,
  -- work
  company       text,
  title         text,
  industry      text,
  bio           text,
  looking_for   text,
  can_help_with text,
  -- socials (stored as typed; links are built safely client-side)
  linkedin      text,
  instagram     text,
  facebook      text,
  x             text,
  tiktok        text,
  youtube       text,
  website       text,
  whatsapp      text,
  -- privacy
  show_email    boolean not null default true,
  show_phone    boolean not null default false,
  -- AI-organized fields
  ai_industry   text,            -- normalized industry label
  tags          text[] not null default '{}',
  ai_summary    text,            -- 1-2 sentence third-person summary
  search_text   text,            -- everything searchable, flattened
  fts           tsvector generated always as (to_tsvector('english', coalesce(search_text, ''))) stored,
  embedding     extensions.vector(768),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists members_fts_idx on public.members using gin (fts);
create index if not exists members_embedding_idx on public.members
  using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists members_industry_idx on public.members (ai_industry);

-- Only the server (service role) reads/writes members. The API strips
-- private fields (hidden email/phone) before anything reaches a browser.
alter table public.members enable row level security;

create table if not exists public.suggestions (
  id         bigserial primary key,
  member_id  uuid references public.members(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.suggestions enable row level security;

-- Hybrid search: semantic similarity + keyword match + optional radius.
create or replace function public.search_members(
  query_embedding extensions.vector(768) default null,
  keyword         text default null,
  near_lat        double precision default null,
  near_lng        double precision default null,
  radius_km       double precision default null,
  max_results     int default 40
)
returns table (id uuid, similarity double precision, keyword_rank real, distance_km double precision)
language sql stable
set search_path = public, extensions
as $$
  with scored as (
    select
      m.id,
      case when query_embedding is null or m.embedding is null then null
           else 1 - (m.embedding <=> query_embedding) end as similarity,
      case when keyword is null or keyword = '' then null
           else ts_rank(m.fts, websearch_to_tsquery('english', keyword)) end as keyword_rank,
      case when near_lat is null or m.lat is null then null
           else 6371 * 2 * asin(sqrt(
             power(sin(radians(m.lat - near_lat) / 2), 2) +
             cos(radians(near_lat)) * cos(radians(m.lat)) *
             power(sin(radians(m.lng - near_lng) / 2), 2)
           )) end as distance_km
    from public.members m
  )
  select s.id, s.similarity, s.keyword_rank, s.distance_km
  from scored s
  where (radius_km is null or (s.distance_km is not null and s.distance_km <= radius_km))
  order by
    coalesce(s.similarity, 0) + coalesce(s.keyword_rank, 0) * 2 desc,
    s.distance_km asc nulls last
  limit greatest(1, least(max_results, 200));
$$;

revoke all on function public.search_members from public, anon, authenticated;

-- Profile pictures (added v2). Stored in a public bucket under an unguessable
-- path; uploads go through /api/avatar (service role) only.
alter table public.members add column if not exists avatar_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Multiple industries (added v3). The member's own words; `industry` keeps the
-- joined string for display/back-compat.
alter table public.members add column if not exists industries text[] not null default '{}';
update public.members
set industries = array(select btrim(x) from unnest(string_to_array(industry, ',')) x where btrim(x) <> '')
where cardinality(industries) = 0 and coalesce(industry, '') <> '';

-- Personal saved contacts (added v4). Private to each member; server-only access.
create table if not exists public.saved_contacts (
  member_id  uuid not null references public.members(id) on delete cascade,
  contact_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, contact_id),
  check (member_id <> contact_id)
);
alter table public.saved_contacts enable row level security;
