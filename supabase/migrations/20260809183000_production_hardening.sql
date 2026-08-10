-- Gannamasti production hardening. Idempotent and safe to rerun.
begin;
alter table public.delivery_profiles
  add column if not exists is_approved boolean not null default false,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;
-- Existing delivery profiles were created before approval existed. Preserve them,
-- but all new profiles require explicit admin approval.
update public.delivery_profiles set is_approved = true where is_approved = false;
alter table public.menu_item_sizes
  add column if not exists extra_cheese_price_paise integer;
alter table public.orders
  add column if not exists accepted_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists refund_status text not null default 'not_required',
  add column if not exists refund_id text,
  add column if not exists delivery_house text,
  add column if not exists delivery_area text,
  add column if not exists delivery_landmark text,
  add column if not exists delivery_city text default 'Rohtak',
  add column if not exists invoice_number text;
do $$ begin
  alter table public.orders add constraint orders_refund_status_check
    check (refund_status in ('not_required','pending','processed','failed'));
exception when duplicate_object then null; end $$;
create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_name text not null default 'Gannamasti Cafe',
  is_open boolean not null default true,
  temporarily_closed boolean not null default false,
  opening_time time not null default '10:00',
  closing_time time not null default '22:00',
  timezone text not null default 'Asia/Kolkata',
  closed_message text not null default 'Cafe is currently closed. You can browse the menu and order when we reopen at 10:00 AM.',
  platform_fee_paise integer not null default 600 check (platform_fee_paise >= 0),
  sugarcane_packaging_fee_paise integer not null default 500 check (sugarcane_packaging_fee_paise >= 0),
  delivery_fee_paise integer not null default 5000 check (delivery_fee_paise >= 0),
  free_delivery_threshold_paise integer not null default 29900 check (free_delivery_threshold_paise >= 0),
  pickup_discount_percent numeric(5,2) not null default 10 check (pickup_discount_percent between 0 and 100),
  delivery_city text not null default 'Rohtak',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
-- Upgrade the legacy settings table in place when it already exists.
alter table public.store_settings
  add column if not exists store_name text not null default 'Gannamasti Cafe',
  add column if not exists is_open boolean not null default true,
  add column if not exists temporarily_closed boolean not null default false,
  add column if not exists opening_time time not null default '10:00',
  add column if not exists closing_time time not null default '22:00',
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists closed_message text not null default 'Cafe is currently closed. You can browse the menu and order when we reopen at 10:00 AM.',
  add column if not exists platform_fee_paise integer not null default 600,
  add column if not exists sugarcane_packaging_fee_paise integer not null default 500,
  add column if not exists delivery_fee_paise integer not null default 5000,
  add column if not exists free_delivery_threshold_paise integer not null default 29900,
  add column if not exists pickup_discount_percent numeric(5,2) not null default 10,
  add column if not exists delivery_city text not null default 'Rohtak',
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;
insert into public.store_settings default values;
delete from public.store_settings where id not in (select id from public.store_settings order by created_at nulls last, id limit 1);
update public.store_settings
set platform_fee_paise = coalesce(platform_fee::integer * 100, platform_fee_paise),
    sugarcane_packaging_fee_paise = coalesce(packing_charge_per_item::integer * 100, sugarcane_packaging_fee_paise)
where platform_fee is not null or packing_charge_per_item is not null;
create table if not exists public.order_cancellations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  cancelled_items jsonb,
  status text not null default 'requested' check (status in ('requested','approved','rejected','refunded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, menu_item_id, user_id)
);
alter table public.store_settings enable row level security;
alter table public.order_cancellations enable row level security;
alter table public.reviews enable row level security;
drop policy if exists "Public can view store settings" on public.store_settings;
create policy "Public can view store settings" on public.store_settings for select using (true);
drop policy if exists "Admins manage store settings" on public.store_settings;
create policy "Admins manage store settings" on public.store_settings for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Users view own cancellations" on public.order_cancellations;
create policy "Users view own cancellations" on public.order_cancellations for select
  using (requested_by = auth.uid() or public.is_admin());
drop policy if exists "Users request eligible cancellations" on public.order_cancellations;
create policy "Users request eligible cancellations" on public.order_cancellations for insert
  with check (requested_by = auth.uid() and exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status in ('pending','paid')
  ));
drop policy if exists "Admins manage cancellations" on public.order_cancellations;
create policy "Admins manage cancellations" on public.order_cancellations for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public views approved reviews" on public.reviews;
create policy "Public views approved reviews" on public.reviews for select
  using (is_approved or user_id = auth.uid() or public.is_admin());
drop policy if exists "Customers create verified reviews" on public.reviews;
create policy "Customers create verified reviews" on public.reviews for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid() and o.status = 'completed'
  ));
drop policy if exists "Customers edit own reviews" on public.reviews;
create policy "Customers edit own reviews" on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews" on public.reviews for all
  using (public.is_admin()) with check (public.is_admin());
-- Remove self-registration privilege. Drivers can update an already approved profile;
-- admins create/approve profiles via server-side endpoints.
drop policy if exists "Users can manage their own delivery profile" on public.delivery_profiles;
drop policy if exists "Anyone can view active delivery profiles" on public.delivery_profiles;
create policy "Approved drivers view own profile" on public.delivery_profiles for select
  using (auth.uid() = user_id or public.is_admin());
create policy "Approved drivers update own status" on public.delivery_profiles for update
  using (auth.uid() = user_id and is_approved = true)
  with check (auth.uid() = user_id and is_approved = true);
create policy "Admins manage delivery profiles" on public.delivery_profiles for all
  using (public.is_admin()) with check (public.is_admin());
-- Atomic claim: only an approved, active driver can win an unassigned order.
create or replace function public.claim_delivery(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  if not exists (
    select 1 from delivery_profiles
    where user_id = auth.uid() and is_approved = true and is_active = true
  ) then raise exception 'Approved active driver required'; end if;

  update orders
  set delivery_boy_id = auth.uid(), delivery_status = 'assigned'
  where id = p_order_id
    and delivery_type = 'delivery'
    and status = 'completed'
    and delivery_status = 'unassigned'
    and delivery_boy_id is null;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.claim_delivery(uuid) from public;
grant execute on function public.claim_delivery(uuid) to authenticated;
commit;
