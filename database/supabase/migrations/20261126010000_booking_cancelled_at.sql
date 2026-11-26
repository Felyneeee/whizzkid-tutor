alter table public.bookings
  add column if not exists cancelled_at timestamptz;
