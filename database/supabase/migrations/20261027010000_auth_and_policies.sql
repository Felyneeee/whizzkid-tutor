-- Link app identities to Supabase Auth and keep row access scoped by role.
alter table public.users add column if not exists auth_id uuid unique references auth.users(id) on delete cascade;

drop policy if exists users_read_self_or_admin on public.users;
drop policy if exists users_update_admin on public.users;
drop policy if exists tutee_profiles_access on public.tutee_profiles;
drop policy if exists tutee_profiles_read_related on public.tutee_profiles;
drop policy if exists tutee_profiles_write_owner on public.tutee_profiles;
drop policy if exists tutor_profiles_access on public.tutor_profiles;
drop policy if exists tutor_profiles_read_related on public.tutor_profiles;
drop policy if exists tutor_profiles_write_owner on public.tutor_profiles;
drop policy if exists rooms_read_authenticated on public.rooms;
drop policy if exists rooms_write_admin on public.rooms;
drop policy if exists cohorts_read_authenticated on public.cohorts;
drop policy if exists cohorts_write_admin on public.cohorts;
drop policy if exists assessments_access on public.assessments;
drop policy if exists bookings_access on public.bookings;
drop policy if exists sessions_access on public.sessions;
drop policy if exists availability_access on public.availability;
drop policy if exists leaves_access on public.leaves;
drop policy if exists messages_access on public.messages;
drop policy if exists notifications_access on public.notifications;
drop policy if exists purchases_access on public.purchases;
drop policy if exists materials_read_access on public.materials;
drop policy if exists materials_write_admin on public.materials;
drop policy if exists material_logs_access on public.material_logs;
drop policy if exists activities_access on public.activities;
drop policy if exists payroll_access on public.payroll;
drop policy if exists hirings_read_authenticated on public.hirings;
drop policy if exists hirings_write_admin on public.hirings;

create or replace function public.app_current_role()
returns text
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select role from public.users where auth_id = auth.uid() limit 1
$$;

create or replace function public.app_is_admin()
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select coalesce(public.app_current_role() = 'admin', false)
$$;

create or replace function public.app_can_read_tutee(target_user_id text)
returns boolean language sql stable security definer
set search_path = public set row_security = off
as $$
  select public.app_is_admin() or target_user_id = auth.uid()::text or exists (
    select 1 from public.bookings b where b.tutee_id = target_user_id and b.tutor_id = auth.uid()::text
  ) or exists (
    select 1 from public.sessions s where s.tutee_id = target_user_id and s.tutor_id = auth.uid()::text
  )
$$;

create or replace function public.app_can_read_tutor(target_user_id text)
returns boolean language sql stable security definer
set search_path = public set row_security = off
as $$
  select public.app_is_admin() or target_user_id = auth.uid()::text or exists (
    select 1 from public.bookings b where b.tutor_id = target_user_id and b.tutee_id = auth.uid()::text
  ) or exists (
    select 1 from public.sessions s where s.tutor_id = target_user_id and s.tutee_id = auth.uid()::text
  )
$$;

create or replace function public.app_handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  app_role text;
  app_username text;
  admin_user_id text;
begin
  app_role := case when new.raw_user_meta_data ->> 'role' = 'tutor' then 'tutor' else 'tutee' end;
  app_username := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1));
  insert into public.users (id, auth_id, role, email, username)
  values (new.id::text, new.id, app_role, new.email, app_username)
  on conflict (id) do update set auth_id = excluded.auth_id, email = excluded.email, username = excluded.username;

  if app_role = 'tutee' then
    insert into public.tutee_profiles (user_id) values (new.id::text) on conflict (user_id) do nothing;
  else
    insert into public.tutor_profiles (
      user_id, applicant_type, status, full_name, age, contact, resume_name,
      bio, subjects, grade_bands, birthday
    )
    values (
      new.id::text,
      case when new.raw_user_meta_data ->> 'applicantType' = 'existing' then 'existing' else 'new' end,
      case when new.raw_user_meta_data ->> 'applicantType' = 'existing' then 'pending_verification' else 'pending_review' end,
      coalesce(new.raw_user_meta_data ->> 'fullName', ''),
      nullif(new.raw_user_meta_data ->> 'age', '')::integer,
      coalesce(new.raw_user_meta_data ->> 'contact', ''),
      coalesce(new.raw_user_meta_data ->> 'resumeName', ''),
      coalesce(new.raw_user_meta_data ->> 'bio', ''),
      coalesce(new.raw_user_meta_data -> 'subjects', '[]'::jsonb),
      coalesce(new.raw_user_meta_data -> 'gradeBands', '[]'::jsonb),
      nullif(new.raw_user_meta_data ->> 'birthday', '')::date
    )
    on conflict (user_id) do nothing;
    insert into public.notifications (id, user_id, text, channels)
      select gen_random_uuid()::text, id, 'New tutor application from ' || coalesce(new.raw_user_meta_data ->> 'fullName', app_username), '["web"]'::jsonb
      from public.users where role = 'admin';
  end if;
  select id into admin_user_id from public.users where role = 'admin' limit 1;
  if admin_user_id is not null then
    insert into public.messages (id, thread_id, from_id, text, auto)
      values (gen_random_uuid()::text, new.id::text, admin_user_id,
        'Welcome to Whizzkids! Please complete your profile to start booking.', true);
    insert into public.notifications (id, user_id, text, channels)
      values (gen_random_uuid()::text, new.id::text, 'Welcome to Whizzkids! Complete your profile to start booking.', '["web", "email"]'::jsonb);
  end if;
  return new;
end
$$;

drop trigger if exists app_auth_user_created on auth.users;
create trigger app_auth_user_created after insert on auth.users
for each row execute function public.app_handle_new_auth_user();

create or replace function public.app_guard_tutor_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.app_is_admin() then
    new.applicant_type := old.applicant_type;
    new.status := old.status;
    new.hourly_rate := old.hourly_rate;
    new.fixed_salary := old.fixed_salary;
    new.interview_at := old.interview_at;
    new.interview_notes := old.interview_notes;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end
$$;

drop trigger if exists tutor_profile_guard on public.tutor_profiles;
create trigger tutor_profile_guard before update on public.tutor_profiles
for each row execute function public.app_guard_tutor_profile();

create or replace function public.app_notify_new_message()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  sender_role text;
  sender_name text;
begin
  select role, coalesce((select full_name from public.tutee_profiles where user_id = new.from_id),
                        (select full_name from public.tutor_profiles where user_id = new.from_id), username)
    into sender_role, sender_name from public.users where id = new.from_id;
  if sender_role = 'admin' then
    insert into public.notifications (id, user_id, thread_id, text, channels)
      values (gen_random_uuid()::text, new.thread_id, new.thread_id, 'New message from ' || sender_name, '["web", "email", "sms"]'::jsonb);
  else
    insert into public.notifications (id, user_id, thread_id, text, channels)
      select gen_random_uuid()::text, id, new.thread_id, 'New message from ' || sender_name, '["web", "email", "sms"]'::jsonb
      from public.users where role = 'admin';
  end if;
  return new;
end
$$;

drop trigger if exists app_message_notification on public.messages;
create trigger app_message_notification after insert on public.messages
for each row execute function public.app_notify_new_message();

create or replace function public.app_notify_admin_activity()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  subject_user_id text;
  subject_name text;
  notification_text text;
begin
  if tg_table_name = 'bookings' and nullif(to_jsonb(new) ->> 'cohort_id', '') is not null then
    update public.cohorts
      set enrolled = case when enrolled ? (to_jsonb(new) ->> 'tutee_id') then enrolled
        else enrolled || jsonb_build_array(to_jsonb(new) ->> 'tutee_id') end
      where id = to_jsonb(new) ->> 'cohort_id';
  end if;
  subject_user_id := case tg_table_name
    when 'bookings' then to_jsonb(new) ->> 'tutee_id'
    when 'assessments' then to_jsonb(new) ->> 'tutee_id'
    when 'availability' then to_jsonb(new) ->> 'tutor_id'
    when 'leaves' then to_jsonb(new) ->> 'tutor_id'
    when 'purchases' then to_jsonb(new) ->> 'tutee_id'
  end;
  select coalesce((select full_name from public.tutee_profiles where user_id = subject_user_id),
                  (select full_name from public.tutor_profiles where user_id = subject_user_id), username)
    into subject_name from public.users where id = subject_user_id;
  notification_text := case tg_table_name
    when 'bookings' then 'New booking request from ' || coalesce(subject_name, 'a tutee')
    when 'assessments' then 'New reading assessment booked by ' || coalesce(subject_name, 'a tutee')
    when 'availability' then 'New availability submitted by ' || coalesce(subject_name, 'a tutor')
    when 'leaves' then 'New leave request from ' || coalesce(subject_name, 'a tutor')
    when 'purchases' then 'New purchase from ' || coalesce(subject_name, 'a tutee')
  end;
  insert into public.notifications (id, user_id, text, channels)
    select gen_random_uuid()::text, id, notification_text, '["web"]'::jsonb
    from public.users where role = 'admin';
  return new;
end
$$;

drop trigger if exists app_booking_admin_notification on public.bookings;
create trigger app_booking_admin_notification after insert on public.bookings
for each row execute function public.app_notify_admin_activity();
drop trigger if exists app_assessment_admin_notification on public.assessments;
create trigger app_assessment_admin_notification after insert on public.assessments
for each row execute function public.app_notify_admin_activity();
drop trigger if exists app_availability_admin_notification on public.availability;
create trigger app_availability_admin_notification after insert on public.availability
for each row execute function public.app_notify_admin_activity();
drop trigger if exists app_leave_admin_notification on public.leaves;
create trigger app_leave_admin_notification after insert on public.leaves
for each row execute function public.app_notify_admin_activity();
drop trigger if exists app_purchase_admin_notification on public.purchases;
create trigger app_purchase_admin_notification after insert on public.purchases
for each row execute function public.app_notify_admin_activity();

create policy users_read_self_or_admin on public.users for select to authenticated
using (auth_id = auth.uid() or public.app_is_admin());
create policy users_update_admin on public.users for update to authenticated
using (public.app_is_admin()) with check (public.app_is_admin());

create policy tutee_profiles_read_related on public.tutee_profiles for select to authenticated
using (public.app_can_read_tutee(user_id));
create policy tutee_profiles_write_owner on public.tutee_profiles for all to authenticated
using (user_id = auth.uid()::text or public.app_is_admin())
with check (user_id = auth.uid()::text or public.app_is_admin());
create policy tutor_profiles_read_related on public.tutor_profiles for select to authenticated
using (public.app_can_read_tutor(user_id));
create policy tutor_profiles_write_owner on public.tutor_profiles for all to authenticated
using (user_id = auth.uid()::text or public.app_is_admin())
with check (user_id = auth.uid()::text or public.app_is_admin());

create policy rooms_read_authenticated on public.rooms for select to authenticated using (true);
create policy rooms_write_admin on public.rooms for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy cohorts_read_authenticated on public.cohorts for select to authenticated using (true);
create policy cohorts_write_admin on public.cohorts for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

create policy assessments_access on public.assessments for all to authenticated
using (tutee_id = auth.uid()::text or public.app_is_admin()) with check (tutee_id = auth.uid()::text or public.app_is_admin());
create policy bookings_access on public.bookings for all to authenticated
using (tutee_id = auth.uid()::text or tutor_id = auth.uid()::text or public.app_is_admin())
with check (tutee_id = auth.uid()::text or tutor_id = auth.uid()::text or public.app_is_admin());
create policy sessions_access on public.sessions for all to authenticated
using (tutee_id = auth.uid()::text or tutor_id = auth.uid()::text or public.app_is_admin())
with check (tutee_id = auth.uid()::text or tutor_id = auth.uid()::text or public.app_is_admin());
create policy availability_access on public.availability for all to authenticated
using (tutor_id = auth.uid()::text or public.app_is_admin()) with check (tutor_id = auth.uid()::text or public.app_is_admin());
create policy leaves_access on public.leaves for all to authenticated
using (tutor_id = auth.uid()::text or public.app_is_admin()) with check (tutor_id = auth.uid()::text or public.app_is_admin());

create policy messages_access on public.messages for all to authenticated
using (public.app_is_admin() or (thread_id = auth.uid()::text and from_id = auth.uid()::text))
with check (public.app_is_admin() or (thread_id = auth.uid()::text and from_id = auth.uid()::text));
create policy notifications_access on public.notifications for all to authenticated
using (user_id = auth.uid()::text or public.app_is_admin()) with check (user_id = auth.uid()::text or public.app_is_admin());
create policy purchases_access on public.purchases for all to authenticated
using (tutee_id = auth.uid()::text or public.app_is_admin()) with check (tutee_id = auth.uid()::text or public.app_is_admin());

create policy materials_read_access on public.materials for select to authenticated using (
  public.app_is_admin() or (not revoked and
    (allowed_user_ids = '[]'::jsonb or allowed_user_ids ? auth.uid()::text) and
    ((public.app_current_role() = 'tutor' and allow_tutors) or (public.app_current_role() = 'tutee' and allow_tutees)))
);
create policy materials_write_admin on public.materials for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy material_logs_access on public.material_logs for all to authenticated
using (user_id = auth.uid()::text or public.app_is_admin()) with check (user_id = auth.uid()::text or public.app_is_admin());
create policy activities_access on public.activities for all to authenticated
using (user_id = auth.uid()::text or public.app_is_admin()) with check (user_id = auth.uid()::text or public.app_is_admin());
create policy payroll_access on public.payroll for all to authenticated
using (tutor_id = auth.uid()::text or public.app_is_admin()) with check (tutor_id = auth.uid()::text or public.app_is_admin());
create policy hirings_read_authenticated on public.hirings for select to authenticated using (true);
create policy hirings_write_admin on public.hirings for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'tutee_profiles', 'tutor_profiles', 'rooms', 'cohorts', 'assessments',
    'bookings', 'sessions', 'availability', 'leaves', 'messages', 'notifications',
    'purchases', 'materials', 'material_logs', 'activities', 'payroll', 'hirings'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
