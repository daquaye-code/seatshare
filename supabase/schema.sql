-- SeatShare: staff commuter pilot. Run this once in the Supabase SQL Editor.


-- ============ Tables ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  staff_id text not null unique,
  phone text not null,
  office text not null,
  is_rider boolean not null default true,
  is_driver boolean not null default false,
  emergency_name text not null,
  emergency_phone text not null,
  accepted_terms_at timestamptz not null,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.profiles(id) on delete cascade,
  make text not null,
  colour text not null,
  plate text not null,
  seats int not null check (seats between 1 and 6),
  licence_expiry date not null,
  insurance_expiry date not null,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.corridors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  fare_ghs numeric(8,2) not null check (fare_ghs >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  corridor_id uuid not null references public.corridors(id) on delete cascade,
  name text not null,
  seq int not null default 0
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  corridor_id uuid not null references public.corridors(id),
  depart_at timestamptz not null,
  seats_offered int not null check (seats_offered between 1 and 6),
  status text not null default 'open' check (status in ('open','cancelled')),
  created_at timestamptz not null default now()
);
create index rides_corridor_time on public.rides(corridor_id, depart_at);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  pickup_point_id uuid not null references public.pickup_points(id),
  fare_ghs numeric(8,2) not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bookings_one_live_per_rider
  on public.bookings(ride_id, rider_id) where status in ('pending','accepted');

-- ============ Helper functions ============

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- True when the signed in user and "other" are on the same live booking
create or replace function public.shares_booking(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b join rides r on r.id = b.ride_id
    where b.status in ('pending','accepted') and (
      (b.rider_id = auth.uid() and r.driver_id = other) or
      (r.driver_id = auth.uid() and b.rider_id = other)));
$$;

create or replace function public.is_ride_driver(p_ride uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rides where id = p_ride and driver_id = auth.uid());
$$;

create or replace function public.has_booking_on(p_ride uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings where ride_id = p_ride and rider_id = auth.uid());
$$;

-- A driver may post a ride only if active, verified, documents in date, seats fit the car
create or replace function public.can_drive(p_seats int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join vehicles v on v.driver_id = p.id
    where p.id = auth.uid() and p.status = 'active' and p.is_driver
      and v.verified and p_seats <= v.seats
      and v.licence_expiry >= current_date and v.insurance_expiry >= current_date);
$$;

-- ============ Guards ============

-- Anyone can sign up with a personal email, but every new profile starts as
-- 'pending' and cannot book or post rides until an admin approves it.

-- Users cannot change their own role, status or email
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.email is distinct from old.email then
      raise exception 'You cannot change role, status or email';
    end if;
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- Drivers cannot verify themselves; editing car details needs a fresh check
create or replace function public.protect_vehicle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false; new.verified_at := null; new.verified_by := null;
    else
      if new.verified is distinct from old.verified
         or new.verified_by is distinct from old.verified_by
         or new.verified_at is distinct from old.verified_at then
        raise exception 'Only an admin can verify a vehicle';
      end if;
      if (new.make, new.colour, new.plate, new.seats, new.licence_expiry, new.insurance_expiry)
         is distinct from
         (old.make, old.colour, old.plate, old.seats, old.licence_expiry, old.insurance_expiry) then
        new.verified := false; new.verified_at := null; new.verified_by := null;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger protect_vehicle before insert or update on public.vehicles
  for each row execute function public.protect_vehicle();

-- ============ Row level security ============

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.corridors enable row level security;
alter table public.pickup_points enable row level security;
alter table public.rides enable row level security;
alter table public.bookings enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_booking(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'user' and status = 'pending'
              and lower(email) = lower(auth.jwt() ->> 'email'));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy vehicles_select on public.vehicles for select to authenticated
  using (driver_id = auth.uid() or public.is_admin() or public.shares_booking(driver_id));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (driver_id = auth.uid());
create policy vehicles_update on public.vehicles for update to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy corridors_read on public.corridors for select to authenticated using (true);
create policy corridors_admin on public.corridors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy pickups_read on public.pickup_points for select to authenticated using (true);
create policy pickups_admin on public.pickup_points for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rides_select on public.rides for select to authenticated
  using (driver_id = auth.uid() or public.is_admin() or public.has_booking_on(id));
create policy rides_insert on public.rides for insert to authenticated
  with check (driver_id = auth.uid() and status = 'open'
              and depart_at > now() and public.can_drive(seats_offered));
create policy rides_admin_update on public.rides for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy bookings_select on public.bookings for select to authenticated
  using (rider_id = auth.uid() or public.is_admin() or public.is_ride_driver(ride_id));
-- No insert or update policies on bookings: all changes go through the functions below.

-- ============ Actions (called from the app) ============

create or replace function public.list_rides(p_corridor uuid, p_day date)
returns table (ride_id uuid, depart_at timestamptz, seats_left int,
               driver_name text, vehicle text, my_status text)
language sql stable security definer set search_path = public as $$
  select r.id, r.depart_at,
    (r.seats_offered - (select count(*) from bookings b
       where b.ride_id = r.id and b.status in ('pending','accepted')))::int,
    split_part(p.full_name, ' ', 1),
    v.colour || ' ' || v.make,
    (select b.status from bookings b where b.ride_id = r.id
       and b.rider_id = auth.uid() and b.status in ('pending','accepted') limit 1)
  from rides r
  join profiles p on p.id = r.driver_id
  join vehicles v on v.driver_id = r.driver_id
  where public.is_active()
    and r.corridor_id = p_corridor and r.status = 'open'
    and r.depart_at >= greatest(now(), p_day::timestamptz)
    and r.depart_at < (p_day + 1)::timestamptz
    and r.driver_id <> auth.uid()
    and p.status = 'active'
  order by r.depart_at;
$$;

create or replace function public.book_seat(p_ride uuid, p_pickup uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r rides%rowtype; taken int; fare numeric; new_id uuid;
begin
  if not public.is_active() then raise exception 'Your account is not active'; end if;
  select * into r from rides where id = p_ride for update;
  if not found or r.status <> 'open' then raise exception 'This ride is no longer available'; end if;
  if r.depart_at <= now() then raise exception 'This ride has already left'; end if;
  if r.driver_id = auth.uid() then raise exception 'You cannot book your own ride'; end if;
  if not exists (select 1 from pickup_points where id = p_pickup and corridor_id = r.corridor_id) then
    raise exception 'Choose a pickup point on this corridor';
  end if;
  select count(*) into taken from bookings
    where ride_id = p_ride and status in ('pending','accepted');
  if taken >= r.seats_offered then raise exception 'This ride is full'; end if;
  select fare_ghs into fare from corridors where id = r.corridor_id;
  insert into bookings (ride_id, rider_id, pickup_point_id, fare_ghs)
    values (p_ride, auth.uid(), p_pickup, fare) returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You already have a seat on this ride';
end $$;

create or replace function public.respond_booking(p_booking uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype;
begin
  select * into b from bookings where id = p_booking for update;
  if not found or not public.is_ride_driver(b.ride_id) then raise exception 'Booking not found'; end if;
  if b.status <> 'pending' then raise exception 'This booking has already been answered'; end if;
  update bookings set status = case when p_accept then 'accepted' else 'declined' end,
    updated_at = now() where id = p_booking;
end $$;

create or replace function public.cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype; dep timestamptz;
begin
  select * into b from bookings where id = p_booking and rider_id = auth.uid() for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status not in ('pending','accepted') then raise exception 'This booking is already closed'; end if;
  select depart_at into dep from rides where id = b.ride_id;
  if dep < now() + interval '30 minutes' then
    raise exception 'Bookings can only be cancelled up to 30 minutes before departure. Call the driver instead.';
  end if;
  update bookings set status = 'cancelled', updated_at = now() where id = p_booking;
end $$;

create or replace function public.cancel_ride(p_ride uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_ride_driver(p_ride) or public.is_admin()) then
    raise exception 'Ride not found';
  end if;
  update rides set status = 'cancelled' where id = p_ride;
  update bookings set status = 'cancelled', updated_at = now()
    where ride_id = p_ride and status in ('pending','accepted');
end $$;
