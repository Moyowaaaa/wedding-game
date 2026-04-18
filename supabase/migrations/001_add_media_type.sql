-- Run in Supabase SQL editor if you already created the submissions table
-- from the original schema.sql (before video support was added).

alter table public.submissions
  add column if not exists media_type text not null default 'image';

-- Constrain allowed values
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'submissions_media_type_check'
  ) then
    alter table public.submissions
      add constraint submissions_media_type_check
      check (media_type in ('image', 'video'));
  end if;
end $$;
