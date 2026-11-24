alter table public.tutee_profiles
  add column if not exists photo text not null default '';
