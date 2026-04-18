-- Wedding Photo Game — Supabase schema
-- Run this in the Supabase SQL editor once per project.

create extension if not exists "pgcrypto";

create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  guest_name   text        not null,
  challenge    text        not null,
  caption      text,
  image_url    text        not null,
  media_type   text        not null default 'image'
               check (media_type in ('image', 'video')),
  created_at   timestamptz not null default now()
);

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

-- Enable Row Level Security
alter table public.submissions enable row level security;

-- Public read: anyone with the anon key can view the gallery.
drop policy if exists "Public can read submissions" on public.submissions;
create policy "Public can read submissions"
  on public.submissions
  for select
  to anon, authenticated
  using (true);

-- No public insert policy: writes go through the API route using the
-- service role key, which bypasses RLS. If you'd rather let the browser
-- insert directly, add a policy like:
--
--   create policy "Public can insert submissions"
--     on public.submissions
--     for insert
--     to anon
--     with check (
--       char_length(guest_name) between 1 and 80
--       and char_length(challenge) between 1 and 120
--       and char_length(coalesce(caption, '')) <= 500
--       and image_url ~* '^https?://'
--     );

-- Enable Realtime for this table (Dashboard → Database → Replication → enable
-- `submissions` under supabase_realtime, or run:)
alter publication supabase_realtime add table public.submissions;
