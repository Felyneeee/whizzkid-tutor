alter table public.assessments alter column date drop not null;
alter table public.assessments alter column time drop not null;
alter table public.assessments drop constraint if exists assessments_status_check;
alter table public.assessments add constraint assessments_status_check
  check (status in ('pending_admin_scheduling', 'booked', 'completed', 'cancelled'));
