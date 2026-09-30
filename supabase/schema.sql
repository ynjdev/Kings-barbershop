-- =====================================================================
-- Kings Barbershop booking system
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run on a fresh project. It creates the tables, the rules that
-- make double bookings impossible, the functions the website and the
-- admin call, and the security rules (RLS) that keep client data private.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;   -- lets one rule compare barber + time range together

-- ---------- settings (one row) ----------
create table if not exists settings (
  id boolean primary key default true check (id),
  timezone text not null default 'Africa/Johannesburg',
  slot_minutes int not null default 15 check (slot_minutes in (5, 10, 15, 20, 30)),
  lead_minutes int not null default 60 check (lead_minutes >= 0),                 -- earliest online booking from now
  window_days int not null default 30 check (window_days between 1 and 120),      -- how far ahead clients can book
  cancel_cutoff_minutes int not null default 240 check (cancel_cutoff_minutes >= 0), -- online cancel until 4 h before
  max_upcoming_per_phone int not null default 3 check (max_upcoming_per_phone >= 1),
  shop_whatsapp text,                                                              -- digits, starting 27
  site_url text,
  emails_on boolean not null default false                                         -- turned on once automatic emails are set up
);
alter table settings add column if not exists emails_on boolean not null default false;
insert into settings (id) values (true) on conflict do nothing;

-- ---------- barbers, services, hours ----------
create table if not exists barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  role text,
  active boolean not null default true,
  online boolean not null default true,        -- can clients pick him online
  sort int not null default 0
);

create table if not exists services (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),   -- e.g. skin-fade (the website uses these ids)
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  minutes int not null check (minutes > 0 and minutes % 5 = 0),
  active boolean not null default true,
  online boolean not null default true,
  sort int not null default 0
);

-- a barber works on a weekday when there is a row; no row = day off. 0 = Sunday.
create table if not exists working_hours (
  barber_id uuid not null references barbers on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts time not null,
  ends time not null,
  primary key (barber_id, weekday),
  check (starts < ends)
);

-- ---------- clients ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  phone text not null unique check (phone ~ '^27[0-9]{9}$'),   -- stored as 27XXXXXXXXX
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- appointments: bookings and blocked time share one table ----------
do $$ begin
  create type appt_kind as enum ('booking', 'block');
exception when duplicate_object then null; end $$;
do $$ begin
  create type appt_status as enum ('booked', 'done', 'no_show', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type appt_source as enum ('online', 'whatsapp', 'walk_in', 'phone', 'front_desk');
exception when duplicate_object then null; end $$;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  kind appt_kind not null default 'booking',
  barber_id uuid not null references barbers,
  client_id uuid references clients,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appt_status not null default 'booked',
  source appt_source,
  total_cents int not null default 0 check (total_cents >= 0),
  paid boolean not null default false,
  paid_method text check (paid_method in ('cash', 'card', 'snapscan')),
  note text,
  token uuid not null unique default gen_random_uuid(),   -- the client's private "manage booking" link
  confirm_email_at timestamptz,
  reminder_email_at timestamptz,
  reminded_at timestamptz,                                 -- front desk sent the WhatsApp reminder
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at),
  check ((kind = 'booking') = (client_id is not null)),
  -- THE rule: one barber can never have two overlapping appointments (cancelled ones don't count).
  -- Postgres enforces this itself, so two people tapping the same slot at the same second can't both win.
  constraint no_double_booking exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index if not exists appointments_day on appointments (starts_at);
create index if not exists appointments_client on appointments (client_id);

-- what was booked, at the price on the day
create table if not exists appointment_services (
  appointment_id uuid not null references appointments on delete cascade,
  position smallint not null,
  service_id text not null references services,
  name text not null,
  price_cents int not null,
  minutes int not null,
  primary key (appointment_id, position)
);

-- people who can log into the admin (added by hand, see SETUP-BOOKINGS.md)
create table if not exists staff (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'front_desk' check (role in ('admin', 'front_desk'))
);

-- =====================================================================
-- helpers
-- =====================================================================
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid())
$$;

-- 082 123 4567 / +27 82 123 4567 / 27821234567 -> 27821234567 (null if it isn't a SA mobile/landline)
create or replace function normalize_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d ~ '^0[0-9]{9}$' then d := '27' || substr(d, 2); end if;
  if d ~ '^27[0-9]{9}$' then return d; end if;
  return null;
end $$;

-- total price and minutes for a list of service ids; errors on unknown/inactive ones
create or replace function quote_services(p_services text[], p_online_only boolean)
returns table (total_cents int, minutes int)
language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if p_services is null or cardinality(p_services) = 0 then raise exception 'no_services' using errcode = 'P0001'; end if;
  if cardinality(p_services) > 6 then raise exception 'too_many_services' using errcode = 'P0001'; end if;
  if cardinality(p_services) <> (select count(distinct x) from unnest(p_services) x) then raise exception 'duplicate_service' using errcode = 'P0001'; end if;
  select count(*) into n from services s
   where s.id = any(p_services) and s.active and (s.online or not p_online_only);
  if n <> (select count(distinct x) from unnest(p_services) x) then raise exception 'unknown_service' using errcode = 'P0001'; end if;
  return query select sum(s.price_cents)::int, sum(s.minutes)::int from services s where s.id = any(p_services);
end $$;

-- =====================================================================
-- public: what the website can ask
-- =====================================================================

-- open start times on one day for these services. p_barber null = any barber.
create or replace function available_slots(p_day date, p_services text[], p_barber uuid default null)
returns table (barber_id uuid, barber_name text, starts_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  s settings%rowtype;
  q record;
  today date;
begin
  select * into s from settings where id;
  select * into q from quote_services(p_services, true);
  today := (now() at time zone s.timezone)::date;
  if p_day < today or p_day > today + s.window_days then return; end if;

  return query
  with shifts as (
    select b.id as bid, b.name as bname, b.sort,
           ((p_day + wh.starts)::timestamp at time zone s.timezone) as open_at,
           ((p_day + wh.ends)::timestamp at time zone s.timezone) as close_at
      from barbers b
      join working_hours wh on wh.barber_id = b.id and wh.weekday = extract(dow from p_day)
     where b.active and b.online and (p_barber is null or b.id = p_barber)
  ), starts as (
    select sh.bid, sh.bname, sh.sort, g as st
      from shifts sh,
           generate_series(sh.open_at, sh.close_at - make_interval(mins => q.minutes), make_interval(mins => s.slot_minutes)) g
  )
  select st.bid, st.bname, st.st
    from starts st
   where st.st >= now() + make_interval(mins => s.lead_minutes)
     and not exists (
       select 1 from appointments a
        where a.barber_id = st.bid and a.status <> 'cancelled'
          and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(st.st, st.st + make_interval(mins => q.minutes), '[)'))
   order by st.st, st.sort, st.bname;
end $$;

-- book online. Prices and duration come from the database, never from the browser.
create or replace function book_online(
  p_services text[], p_barber uuid, p_start timestamptz,
  p_name text, p_phone text, p_email text default null)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  s settings%rowtype;
  q record;
  v_phone text := normalize_phone(p_phone);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name text := trim(coalesce(p_name, ''));
  v_client uuid;
  v_appt appointments%rowtype;
  cand record;
  v_day date;
begin
  select * into s from settings where id;
  select * into q from quote_services(p_services, true);
  if length(v_name) < 1 or length(v_name) > 80 then raise exception 'bad_name' using errcode = 'P0001'; end if;
  if v_phone is null then raise exception 'bad_phone' using errcode = 'P0001'; end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = 'P0001'; end if;
  v_day := (p_start at time zone s.timezone)::date;

  -- the time must be one the website could have shown (right hours, grid, lead time, window, still free)
  if not exists (select 1 from available_slots(v_day, p_services, p_barber) a where a.starts_at = p_start) then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;

  insert into clients (name, phone, email) values (v_name, v_phone, v_email)
  on conflict (phone) do update set email = coalesce(excluded.email, clients.email)
  returning id into v_client;

  if (select count(*) from appointments a where a.client_id = v_client and a.status = 'booked' and a.starts_at > now())
     >= s.max_upcoming_per_phone then
    raise exception 'too_many_upcoming' using errcode = 'P0001';
  end if;

  -- try the chosen barber, or for "any barber" the free barber with the fewest bookings that day
  for cand in
    select a.barber_id from available_slots(v_day, p_services, p_barber) a
     where a.starts_at = p_start
     order by (select count(*) from appointments x where x.barber_id = a.barber_id and x.status <> 'cancelled'
                 and (x.starts_at at time zone s.timezone)::date = v_day), a.barber_name
  loop
    begin
      insert into appointments (kind, barber_id, client_id, starts_at, ends_at, source, total_cents)
      values ('booking', cand.barber_id, v_client, p_start, p_start + make_interval(mins => q.minutes), 'online', q.total_cents)
      returning * into v_appt;
      exit;
    exception when exclusion_violation then
      v_appt := null;   -- someone got there first; try the next barber
    end;
  end loop;
  if v_appt.id is null then raise exception 'slot_taken' using errcode = 'P0001'; end if;

  insert into appointment_services (appointment_id, position, service_id, name, price_cents, minutes)
  select v_appt.id, row_number() over (order by array_position(p_services, sv.id)), sv.id, sv.name, sv.price_cents, sv.minutes
    from services sv where sv.id = any(p_services);

  return booking_json(v_appt.id);
end $$;

-- the client's own view of one booking (used by the confirmation and the manage page)
create or replace function booking_json(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'token', a.token, 'status', a.status,
    'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'barber', b.name, 'name', c.name, 'total_cents', a.total_cents,
    'has_email', c.email is not null,
    'services', (select json_agg(json_build_object('id', x.service_id, 'name', x.name, 'price_cents', x.price_cents, 'minutes', x.minutes) order by x.position)
                   from appointment_services x where x.appointment_id = a.id),
    'can_cancel', a.status = 'booked' and a.starts_at - now() >= make_interval(mins => (select cancel_cutoff_minutes from settings where id)),
    'cancel_cutoff_minutes', (select cancel_cutoff_minutes from settings where id),
    'shop_whatsapp', (select shop_whatsapp from settings where id))
  from appointments a join barbers b on b.id = a.barber_id join clients c on c.id = a.client_id
  where a.id = p_id and a.kind = 'booking'
$$;

create or replace function booking_by_token(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select booking_json(a.id) from appointments a where a.token = p_token and a.kind = 'booking'
$$;

create or replace function cancel_by_token(p_token uuid) returns json
language plpgsql volatile security definer set search_path = public as $$
declare a appointments%rowtype; cutoff int;
begin
  select cancel_cutoff_minutes into cutoff from settings where id;
  select * into a from appointments where token = p_token and kind = 'booking' for update;
  if a.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if a.status <> 'booked' then raise exception 'not_active' using errcode = 'P0001'; end if;
  if a.starts_at - now() < make_interval(mins => cutoff) then raise exception 'too_late' using errcode = 'P0001'; end if;
  update appointments set status = 'cancelled', cancelled_at = now() where id = a.id;
  return booking_json(a.id);
end $$;

-- =====================================================================
-- front desk: bookings by WhatsApp, phone and walk-in
-- =====================================================================

-- p_client: an existing client id, or null to find/create one by phone
create or replace function staff_book(
  p_services text[], p_barber uuid, p_start timestamptz,
  p_client uuid default null, p_name text default null, p_phone text default null, p_email text default null,
  p_source appt_source default 'whatsapp', p_note text default null)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare q record; v_client uuid := p_client; v_id uuid; v_phone text;
begin
  if not is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  select * into q from quote_services(p_services, false);
  if v_client is null then
    v_phone := normalize_phone(p_phone);
    if v_phone is null then raise exception 'bad_phone' using errcode = 'P0001'; end if;
    if length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_name' using errcode = 'P0001'; end if;
    insert into clients (name, phone, email) values (trim(p_name), v_phone, nullif(lower(trim(coalesce(p_email, ''))), ''))
    on conflict (phone) do update set email = coalesce(excluded.email, clients.email)
    returning id into v_client;
  end if;
  begin
    insert into appointments (kind, barber_id, client_id, starts_at, ends_at, source, total_cents, note)
    values ('booking', p_barber, v_client, p_start, p_start + make_interval(mins => q.minutes), p_source, q.total_cents, p_note)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;
  insert into appointment_services (appointment_id, position, service_id, name, price_cents, minutes)
  select v_id, row_number() over (order by array_position(p_services, sv.id)), sv.id, sv.name, sv.price_cents, sv.minutes
    from services sv where sv.id = any(p_services);
  return v_id;
end $$;

-- move to another time and/or barber, keeping the same length
create or replace function staff_move(p_id uuid, p_barber uuid, p_start timestamptz) returns void
language plpgsql volatile security definer set search_path = public as $$
declare len interval;
begin
  if not is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  select ends_at - starts_at into len from appointments where id = p_id;
  if len is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  begin
    update appointments set barber_id = p_barber, starts_at = p_start, ends_at = p_start + len,
           confirm_email_at = case when kind = 'booking' then null else confirm_email_at end,   -- tell the client the new time
           reminder_email_at = null, reminded_at = null
     where id = p_id;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;
end $$;

-- block time off for one barber (lunch, leave). Refused if it would cover a booking.
create or replace function staff_block(p_barber uuid, p_start timestamptz, p_end timestamptz, p_note text default null) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_staff() then raise exception 'not_staff' using errcode = '42501'; end if;
  begin
    insert into appointments (kind, barber_id, starts_at, ends_at, note) values ('block', p_barber, p_start, p_end, p_note)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;
  return v_id;
end $$;

-- =====================================================================
-- emails: which confirmations and reminders are due (used by the send-emails function)
-- =====================================================================
create or replace function emails_due() returns table (appointment_id uuid, kind text, email text, booking json)
language sql stable security definer set search_path = public as $$
  select a.id, 'confirm', c.email, booking_json(a.id)
    from appointments a join clients c on c.id = a.client_id
   where a.kind = 'booking' and a.status = 'booked' and c.email is not null
     and (select emails_on from settings where id)
     and a.confirm_email_at is null and a.starts_at > now()
  union all
  select a.id, 'reminder', c.email, booking_json(a.id)
    from appointments a join clients c on c.id = a.client_id
   where a.kind = 'booking' and a.status = 'booked' and c.email is not null
     and (select emails_on from settings where id)
     and a.reminder_email_at is null
     and a.starts_at > now() + interval '2 hours'
     and a.starts_at <= now() + interval '24 hours'
     and a.created_at < a.starts_at - interval '24 hours'    -- booked less than a day ahead: the confirmation is the reminder
$$;

create or replace function mark_email_sent(p_id uuid, p_kind text) returns void
language sql volatile security definer set search_path = public as $$
  update appointments
     set confirm_email_at = case when p_kind = 'confirm' then now() else confirm_email_at end,
         reminder_email_at = case when p_kind = 'reminder' then now() else reminder_email_at end
   where id = p_id
$$;

-- =====================================================================
-- security: who can do what
-- =====================================================================
alter table settings enable row level security;
alter table barbers enable row level security;
alter table services enable row level security;
alter table working_hours enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table staff enable row level security;

-- the website may read the menu: active barbers, services, hours and the public settings
drop policy if exists read_settings on settings;       create policy read_settings on settings for select using (true);
drop policy if exists read_barbers on barbers;         create policy read_barbers on barbers for select using (active or is_staff());
drop policy if exists read_services on services;       create policy read_services on services for select using (active or is_staff());
drop policy if exists read_hours on working_hours;     create policy read_hours on working_hours for select using (true);

-- staff can change everything else; nobody else can even read it
drop policy if exists staff_settings on settings;      create policy staff_settings on settings for update using (is_staff()) with check (is_staff());
drop policy if exists staff_barbers on barbers;        create policy staff_barbers on barbers for all using (is_staff()) with check (is_staff());
drop policy if exists staff_services on services;      create policy staff_services on services for all using (is_staff()) with check (is_staff());
drop policy if exists staff_hours on working_hours;    create policy staff_hours on working_hours for all using (is_staff()) with check (is_staff());
drop policy if exists staff_clients on clients;        create policy staff_clients on clients for all using (is_staff()) with check (is_staff());
drop policy if exists staff_appts on appointments;     create policy staff_appts on appointments for all using (is_staff()) with check (is_staff());
drop policy if exists staff_appt_svcs on appointment_services; create policy staff_appt_svcs on appointment_services for all using (is_staff()) with check (is_staff());
drop policy if exists staff_self on staff;             create policy staff_self on staff for select using (is_staff());

-- functions: the public gets only the booking ones; staff ones are for logged-in staff; email ones for the server only
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function available_slots(date, text[], uuid), book_online(text[], uuid, timestamptz, text, text, text),
                          booking_by_token(uuid), cancel_by_token(uuid) to anon, authenticated;
grant execute on function is_staff() to anon;   -- read policies call it; it simply returns false for the public
grant execute on function is_staff(), staff_book(text[], uuid, timestamptz, uuid, text, text, text, appt_source, text),
                          staff_move(uuid, uuid, timestamptz), staff_block(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function emails_due(), mark_email_sent(uuid, text) to service_role;
-- helpers called from inside the functions above run as their owner, so they need no public grant
