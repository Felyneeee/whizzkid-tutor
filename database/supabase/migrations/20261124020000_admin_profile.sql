create table if not exists public.admin_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  full_name text not null default '',
  photo text not null default '',
  age integer,
  birthday date,
  contact text not null default ''
);

alter table public.admin_profiles enable row level security;
