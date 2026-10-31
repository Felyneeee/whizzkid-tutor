-- Whizzkids application schema for Supabase/PostgreSQL.
-- RLS is enabled below with no client policies yet: the current app uses
-- localStorage and mock passwords, so it must not receive direct DB access
-- until Supabase Auth and role-aware policies are implemented.

create table if not exists public.users (
  id text primary key,
  role text not null check (role in ('admin', 'tutor', 'tutee')),
  email text not null unique,
  username text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tutee_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  full_name text not null default '',
  age integer,
  birthday date,
  grade_level text not null default '',
  contact text not null default '',
  guardian_name text not null default '',
  complete boolean not null default false,
  last_greeting_year integer
);

create table if not exists public.tutor_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  applicant_type text not null check (applicant_type in ('new', 'existing')),
  status text not null check (status in ('pending_review', 'interview', 'pending_verification', 'active', 'rejected')),
  full_name text not null default '',
  photo text not null default '',
  age integer,
  contact text not null default '',
  resume_name text not null default '',
  resume_data text not null default '',
  bio text not null default '',
  subjects jsonb not null default '[]'::jsonb,
  grade_bands jsonb not null default '[]'::jsonb,
  hourly_rate numeric not null default 200,
  fixed_salary numeric not null default 0,
  interview_at timestamptz,
  interview_notes text,
  rejection_reason text,
  birthday date,
  last_greeting_year integer
);

create table if not exists public.rooms (
  id text primary key,
  name text not null,
  capacity integer not null check (capacity >= 0)
);

create table if not exists public.cohorts (
  id text primary key,
  label text not null,
  start_date date not null,
  weekdays jsonb not null default '[]'::jsonb,
  time text not null,
  capacity integer not null check (capacity >= 0),
  enrolled jsonb not null default '[]'::jsonb,
  tutor_id text references public.users(id) on delete set null,
  room_id text references public.rooms(id) on delete set null,
  sessions_count integer not null default 0
);

create table if not exists public.assessments (
  id text primary key,
  tutee_id text not null references public.users(id) on delete cascade,
  modality text not null check (modality in ('online', 'face-to-face')),
  date date not null,
  time text not null,
  status text not null check (status in ('booked', 'completed', 'cancelled')),
  results text,
  learning_needs text,
  reading_level text,
  room_id text references public.rooms(id) on delete set null
);

create table if not exists public.bookings (
  id text primary key,
  tutee_id text not null references public.users(id) on delete cascade,
  program text not null check (program in ('reading', 'academic', 'playgroup')),
  subject text not null default '',
  grade_level text not null default '',
  modality text not null check (modality in ('online', 'face-to-face')),
  learning_needs text not null default '',
  booking_type text not null check (booking_type in ('one-time', 'recurring')),
  dates jsonb not null default '[]'::jsonb,
  time text not null,
  recurrence jsonb,
  rate_per_hour numeric not null default 0,
  total_fee numeric not null default 0,
  status text not null check (status in ('awaiting_admin', 'confirmed', 'rejected', 'terminated', 'completed')),
  tutor_id text references public.users(id) on delete set null,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  terminated_at timestamptz,
  termination_reason text,
  cohort_id text references public.cohorts(id) on delete set null,
  assessment_id text references public.assessments(id) on delete set null
);

create table if not exists public.sessions (
  id text primary key,
  booking_id text not null references public.bookings(id) on delete cascade,
  tutor_id text not null references public.users(id) on delete cascade,
  tutee_id text not null references public.users(id) on delete cascade,
  date date not null,
  time text not null,
  modality text not null check (modality in ('online', 'face-to-face')),
  room_id text references public.rooms(id) on delete set null,
  status text not null check (status in ('scheduled', 'completed', 'cancelled', 'needs_reassignment')),
  attended boolean,
  rating integer check (rating between 1 and 5),
  feedback text
);

create table if not exists public.availability (
  id text primary key,
  batch_id text not null,
  tutor_id text not null references public.users(id) on delete cascade,
  date date not null,
  slots jsonb not null default '[]'::jsonb,
  modalities jsonb not null default '[]'::jsonb,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  note text
);

create table if not exists public.leaves (
  id text primary key,
  tutor_id text not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  affected_session_ids jsonb not null default '[]'::jsonb,
  check (end_date >= start_date)
);

create table if not exists public.messages (
  id text primary key,
  thread_id text not null references public.users(id) on delete cascade,
  from_id text not null references public.users(id) on delete cascade,
  text text not null,
  at timestamptz not null default now(),
  auto boolean not null default false
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  thread_id text references public.users(id) on delete cascade,
  text text not null,
  at timestamptz not null default now(),
  read boolean not null default false,
  channels jsonb not null default '["web", "email"]'::jsonb
);

create table if not exists public.purchases (
  id text primary key,
  tutee_id text not null references public.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  status text not null check (status in ('pending', 'paid', 'released')),
  at timestamptz not null default now()
);

create table if not exists public.materials (
  id text primary key,
  title text not null,
  program text not null check (program in ('reading', 'academic', 'playgroup', 'all')),
  file_name text not null,
  mime text not null,
  size bigint not null default 0,
  data text not null default '',
  note text not null default '',
  uploaded_at timestamptz not null default now(),
  allow_tutors boolean not null default false,
  allow_tutees boolean not null default false,
  allowed_user_ids jsonb not null default '[]'::jsonb,
  revoked boolean not null default false
);

create table if not exists public.material_logs (
  id text primary key,
  material_id text not null references public.materials(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('rating', 'match', 'upload', 'termination', 'booking', 'other')),
  text text not null,
  at timestamptz not null default now()
);

create table if not exists public.payroll (
  id text primary key,
  tutor_id text not null references public.users(id) on delete cascade,
  period text not null,
  hours numeric not null default 0,
  hourly_rate numeric not null default 0,
  fixed_salary numeric not null default 0,
  amount numeric not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  unique (tutor_id, period)
);

create table if not exists public.hirings (
  id text primary key,
  title text not null,
  "desc" text not null default '',
  open boolean not null default true
);

create index if not exists messages_thread_at_idx on public.messages (thread_id, at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, read) where read = false;
create index if not exists bookings_tutee_status_idx on public.bookings (tutee_id, status);
create index if not exists sessions_tutor_date_idx on public.sessions (tutor_id, date);
create index if not exists sessions_tutee_date_idx on public.sessions (tutee_id, date);
create index if not exists availability_tutor_date_idx on public.availability (tutor_id, date);

alter table public.users enable row level security;
alter table public.tutee_profiles enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.cohorts enable row level security;
alter table public.assessments enable row level security;
alter table public.bookings enable row level security;
alter table public.sessions enable row level security;
alter table public.availability enable row level security;
alter table public.leaves enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.purchases enable row level security;
alter table public.materials enable row level security;
alter table public.material_logs enable row level security;
alter table public.activities enable row level security;
alter table public.payroll enable row level security;
alter table public.hirings enable row level security;

-- No anon/authenticated policies are created yet. This keeps the new schema
-- private until the app replaces mock login with Supabase Auth and policies.