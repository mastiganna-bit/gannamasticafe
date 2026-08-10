begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

-- Harden role checks used by RLS. Fully-qualified names and an empty search path
-- prevent object-shadowing attacks against SECURITY DEFINER functions.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and (is_admin = true or role::text = 'admin')
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Existing production installations already have some of these fields. Every
-- statement is additive so the migration can reconcile both known schemas.
alter table public.profiles add column if not exists role text default 'customer';
alter table public.profiles add column if not exists phone_verified_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Normalize legacy Indian phone formats before enforcing one phone per account.
-- Older deployments allowed duplicate profile phones even though Auth did not.
update public.profiles
set phone = '+91' || right(regexp_replace(phone, '\D', '', 'g'), 10),
    updated_at = now()
where phone is not null
  and (
    length(regexp_replace(phone, '\D', '', 'g')) = 10
    or (
      length(regexp_replace(phone, '\D', '', 'g')) = 12
      and regexp_replace(phone, '\D', '', 'g') like '91%'
    )
  );

-- Preserve every legacy account and all of its references. When duplicates
-- exist, retain the phone on the account that already owns real operational
-- data (or the verified/most recently used account) and clear only the
-- non-canonical profile phone so the unique index can be created safely.
with ranked_profiles as (
  select
    p.id,
    row_number() over (
      partition by p.phone
      order by
        (u.phone = p.phone) desc nulls last,
        (p.phone_verified_at is not null) desc,
        (exists (select 1 from public.orders o where o.user_id = p.id)) desc,
        (exists (select 1 from public.delivery_profiles d where d.user_id = p.id)) desc,
        u.last_sign_in_at desc nulls last,
        p.id
    ) as phone_rank
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.phone is not null
)
update public.profiles p
set phone = null,
    updated_at = now()
from ranked_profiles r
where p.id = r.id and r.phone_rank > 1;

create unique index if not exists profiles_phone_unique
  on public.profiles (phone) where phone is not null;

create table if not exists public.customer_addresses (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  house text not null,
  area text not null,
  landmark text,
  city text not null default 'Rohtak',
  postal_code text,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint customer_addresses_longitude_check check (longitude is null or longitude between -180 and 180)
);
create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id);
create unique index if not exists customer_addresses_one_default
  on public.customer_addresses(user_id) where is_default;

alter table public.store_settings add column if not exists store_name text default 'Gannamasti Cafe';
alter table public.store_settings add column if not exists is_open boolean default true;
alter table public.store_settings add column if not exists temporarily_closed boolean default false;
alter table public.store_settings add column if not exists opening_time time default '10:00';
alter table public.store_settings add column if not exists closing_time time default '22:00';
alter table public.store_settings add column if not exists timezone text default 'Asia/Kolkata';
alter table public.store_settings add column if not exists closed_message text default 'Cafe is currently closed. You can browse the menu and order when we reopen.';
alter table public.store_settings add column if not exists platform_fee_paise integer default 600;
alter table public.store_settings add column if not exists sugarcane_packaging_fee_paise integer default 500;
alter table public.store_settings add column if not exists delivery_fee_paise integer default 5000;
alter table public.store_settings add column if not exists free_delivery_threshold_paise integer default 30000;
alter table public.store_settings add column if not exists pickup_discount_percent numeric(5,2) default 10;
alter table public.store_settings add column if not exists delivery_city text default 'Rohtak';
alter table public.store_settings add column if not exists cafe_lat double precision default 28.88277051243236;
alter table public.store_settings add column if not exists cafe_lng double precision default 76.58098048394419;
alter table public.store_settings add column if not exists delivery_radius_km numeric(6,2) default 20;
alter table public.store_settings add column if not exists cod_enabled boolean default true;
alter table public.store_settings add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.store_settings add column if not exists updated_at timestamptz default now();

update public.store_settings
set closing_time = '22:00',
    free_delivery_threshold_paise = 30000,
    delivery_radius_km = 20
where true;

alter table public.menu_items add column if not exists slug text;
alter table public.menu_items add column if not exists sort_order integer default 0;
alter table public.menu_items add column if not exists default_size_id uuid;
alter table public.menu_items add column if not exists no_mayonnaise boolean default false;
alter table public.menu_items add column if not exists archived_at timestamptz;
alter table public.menu_items add column if not exists updated_at timestamptz default now();
alter table public.menu_item_sizes add column if not exists extra_cheese_price_paise integer;
alter table public.menu_item_sizes add column if not exists is_available boolean default true;

create table if not exists public.menu_addons (
  id uuid primary key default extensions.gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  size_id uuid references public.menu_item_sizes(id) on delete cascade,
  code text not null,
  label text not null,
  price_paise integer not null check (price_paise >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(menu_item_id, size_id, code)
);

alter table public.orders add column if not exists order_number bigint generated by default as identity;
alter table public.orders add column if not exists client_order_key uuid;
alter table public.orders add column if not exists payment_method text default 'online';
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists fulfillment_status text default 'awaiting_payment';
alter table public.orders add column if not exists items_subtotal_paise integer default 0;
alter table public.orders add column if not exists packaging_fee_paise integer default 0;
alter table public.orders add column if not exists platform_fee_paise integer default 0;
alter table public.orders add column if not exists delivery_fee_paise integer default 0;
alter table public.orders add column if not exists discount_paise integer default 0;
alter table public.orders add column if not exists original_total_paise integer;
alter table public.orders add column if not exists address_id uuid references public.customer_addresses(id) on delete set null;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancelled_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists refund_status text default 'none';
alter table public.orders add column if not exists refund_id text;
alter table public.orders add column if not exists reconciliation_required boolean not null default false;
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists delivery_house text;
alter table public.orders add column if not exists delivery_area text;
alter table public.orders add column if not exists delivery_landmark text;
alter table public.orders add column if not exists delivery_city text;
alter table public.orders add column if not exists delivery_otp_hash text;
alter table public.orders add column if not exists delivery_otp_ciphertext text;
alter table public.orders add column if not exists delivery_otp_expires_at timestamptz;
alter table public.orders add column if not exists delivery_otp_attempts integer default 0;
alter table public.orders add column if not exists assigned_at timestamptz;

update public.orders set
  payment_method = coalesce(payment_method, 'online'),
  payment_status = case
    when payment_status = 'pending' and status in ('paid','preparing','completed') then 'paid'
    when payment_status = 'pending' and status = 'cancelled' then 'cancelled'
    else payment_status
  end,
  fulfillment_status = case
    when fulfillment_status <> 'awaiting_payment' then fulfillment_status
    when status = 'cancelled' then 'cancelled'
    when status = 'completed' and delivery_type = 'delivery' and coalesce(delivery_status, 'unassigned') <> 'delivered' then 'ready'
    when status = 'completed' and delivery_type = 'delivery' and delivery_status = 'delivered' then 'delivered'
    when status = 'completed' then 'completed'
    when status = 'preparing' then 'preparing'
    when status = 'paid' then 'awaiting_acceptance'
    else fulfillment_status
  end
where true;

update public.orders
set original_total_paise = total_paise
where original_total_paise is null;

create unique index if not exists orders_user_client_key_unique
  on public.orders(user_id, client_order_key) where client_order_key is not null;
create unique index if not exists orders_razorpay_order_unique
  on public.orders(razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists orders_razorpay_payment_unique
  on public.orders(razorpay_payment_id) where razorpay_payment_id is not null;
create index if not exists orders_fulfillment_created_idx
  on public.orders(fulfillment_status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  size_id uuid references public.menu_item_sizes(id) on delete set null,
  item_name text not null,
  size_label text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  addon_total_paise integer not null default 0 check (addon_total_paise >= 0),
  quantity integer not null check (quantity between 1 and 25),
  line_total_paise integer not null check (line_total_paise >= 0),
  addons jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  cancelled_quantity integer not null default 0,
  cancel_reason text,
  created_at timestamptz not null default now(),
  constraint order_items_cancelled_quantity_check check (cancelled_quantity between 0 and quantity)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at);

create table if not exists public.payment_events (
  id text primary key,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  razorpay_order_id text,
  razorpay_payment_id text,
  payload jsonb not null,
  status text not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.order_cancellations (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  item_changes jsonb not null default '[]'::jsonb,
  previous_fulfillment_status text,
  full_cancellation boolean not null default true,
  amount_paise integer not null default 0,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
alter table public.order_cancellations add column if not exists previous_fulfillment_status text;
alter table public.order_cancellations add column if not exists full_cancellation boolean not null default true;
alter table public.order_cancellations add column if not exists gateway_refund_id text;

create table if not exists public.password_reset_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  phone text not null,
  provider_verification_id text not null,
  request_ip_hash text not null,
  purpose text not null check (purpose in ('signup','password_reset','account_claim')),
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_phone_created_idx
  on public.password_reset_challenges(phone, created_at desc);
create index if not exists password_reset_ip_created_idx
  on public.password_reset_challenges(request_ip_hash, created_at desc);

create table if not exists public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reviews add column if not exists is_published boolean not null default true;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='is_approved') then
    execute 'update public.reviews set is_published = coalesce(is_approved, true)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='menu_item_id') then
    execute 'alter table public.reviews alter column menu_item_id drop not null';
  end if;
end $$;

alter table public.delivery_profiles add column if not exists is_approved boolean default false;
alter table public.delivery_profiles add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.delivery_profiles add column if not exists approved_at timestamptz;
alter table public.delivery_profiles add column if not exists updated_at timestamptz default now();

create or replace function public.is_approved_driver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.delivery_profiles
    where user_id = (select auth.uid())
      and is_active = true
      and is_approved = true
  );
$$;
revoke all on function public.is_approved_driver() from public, anon;
grant execute on function public.is_approved_driver() to authenticated, service_role;

-- Authoritative server-side serviceability check. Coordinates from the client
-- are inputs only; the database calculates the actual distance.
create or replace function public.check_delivery_serviceability(lat double precision, lng double precision)
returns table(serviceable boolean, distance_km numeric, radius_km numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(s.cafe_lng, s.cafe_lat), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
    ) / 1000) <= s.delivery_radius_km,
    round((extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(s.cafe_lng, s.cafe_lat), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
    ) / 1000)::numeric, 2),
    s.delivery_radius_km
  from public.store_settings s
  order by s.updated_at desc nulls last
  limit 1;
$$;
grant execute on function public.check_delivery_serviceability(double precision, double precision) to authenticated;

-- Replace unsafe policies and remove direct browser writes to protected data.
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Authenticated users can create orders" on public.orders;
drop policy if exists "Users can mark own notifications as read" on public.notifications;
drop policy if exists "Users can manage their own delivery profile" on public.delivery_profiles;
drop policy if exists "Anyone can view active delivery profiles" on public.delivery_profiles;
drop policy if exists "Anyone can view menu sizes" on public.menu_item_sizes;

revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.delivery_profiles from anon, authenticated;
revoke insert, update, delete on public.menu_items from anon, authenticated;
revoke insert, update, delete on public.menu_item_sizes from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
grant insert, update, delete on public.menu_item_sizes to authenticated;

alter table public.customer_addresses enable row level security;
alter table public.menu_addons enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_events enable row level security;
alter table public.order_cancellations enable row level security;
alter table public.password_reset_challenges enable row level security;
alter table public.reviews enable row level security;
alter table public.store_settings enable row level security;

revoke all on public.store_settings from anon, authenticated;
grant select on public.reviews to anon, authenticated;
revoke insert, update, delete on public.reviews from anon, authenticated;

drop policy if exists "Anyone can view available menu items" on public.menu_items;
drop policy if exists menu_items_public_available on public.menu_items;
create policy menu_items_public_available on public.menu_items
  for select to anon, authenticated
  using (is_available = true and archived_at is null);

drop policy if exists customer_addresses_own_all on public.customer_addresses;
create policy customer_addresses_own_all on public.customer_addresses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists menu_sizes_available_parent on public.menu_item_sizes;
create policy menu_sizes_available_parent on public.menu_item_sizes
  for select to anon, authenticated
  using (is_available = true and exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_id and mi.is_available = true and mi.archived_at is null
  ));

drop policy if exists menu_addons_available on public.menu_addons;
create policy menu_addons_available on public.menu_addons
  for select to anon, authenticated using (is_available = true);
drop policy if exists menu_addons_admin_manage on public.menu_addons;
create policy menu_addons_admin_manage on public.menu_addons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.menu_addons to authenticated;

drop policy if exists order_items_customer_read on public.order_items;
create policy order_items_customer_read on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
  ) or public.is_admin() or public.is_approved_driver());

drop policy if exists order_events_customer_read on public.order_events;
create policy order_events_customer_read on public.order_events
  for select to authenticated using (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
  ) or public.is_admin() or public.is_approved_driver());

drop policy if exists cancellations_customer_read on public.order_cancellations;
create policy cancellations_customer_read on public.order_cancellations
  for select to authenticated using (requested_by = (select auth.uid()) or public.is_admin());

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (is_published = true or user_id = (select auth.uid()) or public.is_admin());

drop policy if exists reviews_customer_insert on public.reviews;
create policy reviews_customer_insert on public.reviews
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid())
        and o.fulfillment_status in ('completed','delivered')
    )
  );

drop policy if exists reviews_customer_update on public.reviews;
create policy reviews_customer_update on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists delivery_profiles_approved_read on public.delivery_profiles;
create policy delivery_profiles_approved_read on public.delivery_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists driver_assigned_orders_read on public.orders;
create policy driver_assigned_orders_read on public.orders
  for select to authenticated using (
    delivery_boy_id = (select auth.uid()) and public.is_approved_driver()
  );

drop policy if exists "Assigned drivers can upsert their location" on public.delivery_locations;
drop policy if exists driver_location_manage_assigned on public.delivery_locations;
create policy driver_location_manage_assigned on public.delivery_locations
  for all to authenticated
  using (
    delivery_boy_id = (select auth.uid()) and public.is_approved_driver()
    and exists (select 1 from public.orders o where o.id = order_id and o.delivery_boy_id = (select auth.uid()) and o.fulfillment_status in ('ready','picked_up'))
  )
  with check (
    delivery_boy_id = (select auth.uid()) and public.is_approved_driver()
    and exists (select 1 from public.orders o where o.id = order_id and o.delivery_boy_id = (select auth.uid()) and o.fulfillment_status in ('ready','picked_up'))
  );

-- OTP challenges and payment webhook payloads are server-only.
revoke all on public.password_reset_challenges from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;

create or replace function public.finalize_order_cancellation(
  target_order_id uuid,
  target_cancellation_id uuid,
  previous_fulfillment_status text,
  full_cancellation boolean,
  cancelled_amount_paise integer,
  item_changes jsonb,
  refund_state text,
  gateway_refund_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  change jsonb;
  affected integer;
begin
  if not full_cancellation then
    for change in select * from jsonb_array_elements(item_changes)
    loop
      update public.order_items
      set cancelled_quantity = cancelled_quantity + (change->>'quantity')::integer,
          status = case
            when cancelled_quantity + (change->>'quantity')::integer = quantity then 'cancelled'
            else 'partially_cancelled'
          end,
          cancel_reason = coalesce(change->>'reason', cancel_reason)
      where id = (change->>'orderItemId')::uuid
        and order_id = target_order_id
        and (change->>'quantity')::integer between 1 and (quantity - cancelled_quantity);
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception 'Invalid cancellation item quantity'; end if;
    end loop;
  else
    update public.order_items set cancelled_quantity = quantity, status = 'cancelled'
    where order_id = target_order_id and status <> 'cancelled';
  end if;

  update public.orders
  set total_paise = greatest(0, total_paise - cancelled_amount_paise),
      fulfillment_status = case when full_cancellation then 'cancelled' else previous_fulfillment_status end,
      status = case when full_cancellation then 'cancelled' else status end,
      cancelled_at = case when full_cancellation then now() else cancelled_at end,
      refund_status = refund_state,
      refund_id = coalesce(gateway_refund_id, refund_id),
      updated_at = now()
  where id = target_order_id and fulfillment_status = 'cancellation_pending';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Cancellation reservation was lost'; end if;

  update public.order_cancellations
  set status = 'completed', resolved_at = now()
  where id = target_cancellation_id;
end;
$$;
revoke all on function public.finalize_order_cancellation(uuid,uuid,text,boolean,integer,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.finalize_order_cancellation(uuid,uuid,text,boolean,integer,jsonb,text,text) to service_role;

create or replace function public.admin_save_menu_item(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid := nullif(payload->>'id', '')::uuid;
  size_row jsonb;
  size_id uuid;
  retained_ids uuid[] := '{}'::uuid[];
  default_size uuid;
  position integer := 0;
  affected integer;
begin
  if jsonb_array_length(payload->'sizes') < 1 then raise exception 'At least one size is required'; end if;
  if target_id is null then
    insert into public.menu_items(name,description,category,image_path,is_available,has_sizes,allow_extra_cheese,extra_cheese_price_paise,no_mayonnaise,updated_at)
    values(payload->>'name',nullif(payload->>'description',''),payload->>'category',payload->>'imagePath',(payload->>'isAvailable')::boolean,jsonb_array_length(payload->'sizes')>1,(payload->>'allowExtraCheese')::boolean,case when (payload->>'allowExtraCheese')::boolean then ((payload->'sizes'->((payload->>'defaultSizeIndex')::integer))->>'extraCheesePricePaise')::integer else 0 end,(payload->>'noMayonnaise')::boolean,now())
    returning id into target_id;
  else
    update public.menu_items set name=payload->>'name',description=nullif(payload->>'description',''),category=payload->>'category',image_path=payload->>'imagePath',is_available=(payload->>'isAvailable')::boolean,has_sizes=jsonb_array_length(payload->'sizes')>1,allow_extra_cheese=(payload->>'allowExtraCheese')::boolean,extra_cheese_price_paise=case when (payload->>'allowExtraCheese')::boolean then ((payload->'sizes'->((payload->>'defaultSizeIndex')::integer))->>'extraCheesePricePaise')::integer else 0 end,no_mayonnaise=(payload->>'noMayonnaise')::boolean,updated_at=now()
    where id=target_id and archived_at is null;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Menu item not found'; end if;
  end if;
  for size_row in select value from jsonb_array_elements(payload->'sizes') loop
    position := position + 1;
    size_id := nullif(size_row->>'id','')::uuid;
    if size_id is null then
      insert into public.menu_item_sizes(menu_item_id,size_label,price_paise,extra_cheese_price_paise,is_available,sort_order)
      values(target_id,size_row->>'label',(size_row->>'pricePaise')::integer,case when (payload->>'allowExtraCheese')::boolean then (size_row->>'extraCheesePricePaise')::integer else 0 end,(size_row->>'isAvailable')::boolean,position)
      returning id into size_id;
    else
      update public.menu_item_sizes set size_label=size_row->>'label',price_paise=(size_row->>'pricePaise')::integer,extra_cheese_price_paise=case when (payload->>'allowExtraCheese')::boolean then (size_row->>'extraCheesePricePaise')::integer else 0 end,is_available=(size_row->>'isAvailable')::boolean,sort_order=position
      where id=size_id and menu_item_id=target_id;
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception 'Invalid menu size'; end if;
    end if;
    retained_ids := array_append(retained_ids,size_id);
    if position - 1 = (payload->>'defaultSizeIndex')::integer then default_size := size_id; end if;
  end loop;
  delete from public.menu_item_sizes where menu_item_id=target_id and not(id=any(retained_ids));
  update public.menu_items set default_size_id=default_size where id=target_id;
  return target_id;
end;
$$;
revoke all on function public.admin_save_menu_item(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_menu_item(jsonb) to service_role;

commit;
