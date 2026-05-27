-- =============================================
-- GANNAMASTI CAFE — COMPLETE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLE: profiles
-- Extends Supabase auth.users
-- =============================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  phone text,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- TABLE: menu_items
-- =============================================
create table public.menu_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  category text not null,
  image_path text not null,
  is_available boolean default true,
  has_sizes boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- TABLE: menu_item_sizes
-- For items with multiple sizes/prices
-- =============================================
create table public.menu_item_sizes (
  id uuid default uuid_generate_v4() primary key,
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  size_label text not null,        -- e.g. "Regular", "Medium", "Half"
  price_paise integer not null,    -- stored in paise (₹20 = 2000)
  sort_order integer default 0
);

-- =============================================
-- TABLE: orders
-- =============================================
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  items jsonb not null,             -- array of ordered items with sizes
  total_paise integer not null,     -- total in paise
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'preparing', 'completed', 'cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  notes text,                       -- special instructions
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger orders_updated_at
  before update on public.orders
  for each row execute procedure update_updated_at();

-- =============================================
-- TABLE: notifications
-- =============================================
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_sizes enable row level security;
alter table public.orders enable row level security;
alter table public.notifications enable row level security;

-- PROFILES policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
end;
$$ language plpgsql security definer;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- MENU ITEMS policies (public read, admin write)
create policy "Anyone can view available menu items"
  on public.menu_items for select
  using (is_available = true);

create policy "Admins can manage menu items"
  on public.menu_items for all
  using (public.is_admin());

-- MENU SIZES policies
create policy "Anyone can view menu sizes"
  on public.menu_item_sizes for select
  using (true);

create policy "Admins can manage sizes"
  on public.menu_item_sizes for all
  using (public.is_admin());

-- ORDERS policies
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Authenticated users can create orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all orders"
  on public.orders for select
  using (public.is_admin());

create policy "Admins can update orders"
  on public.orders for update
  using (public.is_admin());

-- NOTIFICATIONS policies
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark own notifications as read"
  on public.notifications for update
  using (auth.uid() = user_id);

-- =============================================
-- ENABLE REALTIME
-- =============================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.notifications;

-- =============================================
-- SEED: MENU DATA (All items from Gannamasti menu)
-- =============================================

-- THE CANE BAR
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111001', 'Ganna Juice', 'Zero Touch, Zero Ice, 100% Natural fresh sugarcane juice', 'The Cane Bar', '/images/cane/ganna-regular.jpg', true);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111001', 'Regular', 2000, 1),
('11111111-1111-1111-1111-111111111001', 'Medium', 3000, 2),
('11111111-1111-1111-1111-111111111001', 'Large', 4000, 3),
('11111111-1111-1111-1111-111111111001', 'Extra Large', 5000, 4),
('11111111-1111-1111-1111-111111111001', 'Jumbo', 6000, 5);

-- BEVERAGES
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111010', 'Lemon Masala Soda', 'Zesty and refreshing', 'Refresher & Hot Brews', '/images/beverages/lemon-masala-soda.jpg', false),
('11111111-1111-1111-1111-111111111011', 'Green Mint Mojito', 'Cool and refreshing mint mojito', 'Refresher & Hot Brews', '/images/beverages/green-mint-mojito.jpg', false),
('11111111-1111-1111-1111-111111111012', 'Watermelon Mojito', 'Fresh watermelon mojito', 'Refresher & Hot Brews', '/images/beverages/watermelon-mojito.jpg', false),
('11111111-1111-1111-1111-111111111013', 'Blue Lagoon Mojito', 'Tropical blue lagoon mojito', 'Refresher & Hot Brews', '/images/beverages/blue-lagoon-mojito.jpg', false),
('11111111-1111-1111-1111-111111111014', 'Cold Coffee', 'Chilled and creamy cold coffee', 'Refresher & Hot Brews', '/images/beverages/cold-coffee.jpg', false),
('11111111-1111-1111-1111-111111111015', 'Hot Coffee', 'Freshly brewed hot coffee', 'Refresher & Hot Brews', '/images/beverages/hot-coffee.jpg', false),
('11111111-1111-1111-1111-111111111016', 'Classic Chai', 'Traditional Indian chai', 'Refresher & Hot Brews', '/images/beverages/classic-chai.jpg', false),
('11111111-1111-1111-1111-111111111017', 'Masala Chai', 'Spiced masala chai', 'Refresher & Hot Brews', '/images/beverages/masala-chai.jpg', false);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111010', 'Regular', 3000, 1),
('11111111-1111-1111-1111-111111111011', 'Regular', 6000, 1),
('11111111-1111-1111-1111-111111111012', 'Regular', 6000, 1),
('11111111-1111-1111-1111-111111111013', 'Regular', 6000, 1),
('11111111-1111-1111-1111-111111111014', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111015', 'Regular', 3000, 1),
('11111111-1111-1111-1111-111111111016', 'Regular', 2000, 1),
('11111111-1111-1111-1111-111111111017', 'Regular', 3000, 1);

-- BURGERS
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111020', 'Classic Veggie Burger', 'Delicious layers of joy with veggies & sauces', 'Burger Binge', '/images/burgers/classic-veggie-burger.jpg', false),
('11111111-1111-1111-1111-111111111021', 'Double Patty Veggie Burger', 'Double the taste, double the joy', 'Burger Binge', '/images/burgers/double-patty-burger.jpg', false),
('11111111-1111-1111-1111-111111111022', 'Paneer Veggie Burger', 'Cottage cheese with fresh veggies', 'Burger Binge', '/images/burgers/paneer-veggie-burger.jpg', false),
('11111111-1111-1111-1111-111111111023', 'Tandoori Veggie Burger', 'Tandoor-flavoured veggie patty', 'Burger Binge', '/images/burgers/tandoori-veggie-burger.jpg', false),
('11111111-1111-1111-1111-111111111024', 'Melted Cheese Burger', 'Gooey melted cheese perfection', 'Burger Binge', '/images/burgers/melted-cheese-burger.jpg', false),
('11111111-1111-1111-1111-111111111025', 'Deluxe Burger', 'Premium loaded with the best ingredients', 'Burger Binge', '/images/burgers/deluxe-burger.jpg', false);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111020', 'Regular', 4500, 1),
('11111111-1111-1111-1111-111111111021', 'Regular', 6000, 1),
('11111111-1111-1111-1111-111111111022', 'Regular', 6000, 1),
('11111111-1111-1111-1111-111111111023', 'Regular', 8000, 1),
('11111111-1111-1111-1111-111111111024', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111025', 'Regular', 10000, 1);

-- SANDWICHES
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111030', 'Gannamasti Spl. Sandwich', 'Our signature special grilled sandwich', 'Grill & Thrill Sandwiches', '/images/sandwiches/gannamasti-spl-sandwich.jpg', false);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111030', 'Regular', 15000, 1);

-- PIZZA (Premium Loaded)
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111040', 'Mix Veggie', 'Fresh dough, premium toppings & melty cheese', 'Premium Loaded Pizza', '/images/pizza/mix-veggie-pizza.jpg', true),
('11111111-1111-1111-1111-111111111041', 'Mix Veggie with Sweet Corn', 'Mix vegetables topped with sweet corn', 'Premium Loaded Pizza', '/images/pizza/mix-veggie-pizza.jpg', true),
('11111111-1111-1111-1111-111111111042', 'Mix Veggie Paneer', 'Mix vegetables with paneer topping', 'Premium Loaded Pizza', '/images/pizza/paneer-veggie-pizza.jpg', false),
('11111111-1111-1111-1111-111111111043', 'Mix Veggie Pizza', 'Classic mix veggie pizza', 'Premium Loaded Pizza', '/images/pizza/mix-veggie-pizza.jpg', true),
('11111111-1111-1111-1111-111111111044', 'Paneer Veggie', 'Cottage cheese with veggies', 'Premium Loaded Pizza', '/images/pizza/paneer-veggie-pizza.jpg', true),
('11111111-1111-1111-1111-111111111045', 'Tandoori Paneer', 'Tandoori spiced paneer pizza', 'Premium Loaded Pizza', '/images/pizza/tandoori-paneer-pizza.jpg', true),
('11111111-1111-1111-1111-111111111046', 'Cheese Burst', 'Oozing cheese burst pizza', 'Premium Loaded Pizza', '/images/pizza/cheese-burst-pizza.jpg', true),
('11111111-1111-1111-1111-111111111047', 'Fully Loaded', 'Fully loaded with premium toppings', 'Premium Loaded Pizza', '/images/pizza/fully-loaded-pizza.jpg', false),
('11111111-1111-1111-1111-111111111048', 'Margarita', 'Classic margarita pizza', 'Premium Loaded Pizza', '/images/pizza/margarita-pizza.jpg', true),
('11111111-1111-1111-1111-111111111049', 'Gannamasti Spl. Pizza', 'Our ultimate special pizza', 'Premium Loaded Pizza', '/images/pizza/gannamasti-spl-pizza.jpg', false);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111040', 'Half', 5000, 1),
('11111111-1111-1111-1111-111111111040', 'Full', 8000, 2),
('11111111-1111-1111-1111-111111111041', 'Half', 6000, 1),
('11111111-1111-1111-1111-111111111041', 'Full', 9000, 2),
('11111111-1111-1111-1111-111111111042', 'Regular', 12000, 1),
('11111111-1111-1111-1111-111111111043', 'Half', 8000, 1),
('11111111-1111-1111-1111-111111111043', 'Full', 12000, 2),
('11111111-1111-1111-1111-111111111044', 'Half', 10000, 1),
('11111111-1111-1111-1111-111111111044', 'Full', 15000, 2),
('11111111-1111-1111-1111-111111111045', 'Half', 12000, 1),
('11111111-1111-1111-1111-111111111045', 'Full', 18000, 2),
('11111111-1111-1111-1111-111111111046', 'Half', 12000, 1),
('11111111-1111-1111-1111-111111111046', 'Full', 18000, 2),
('11111111-1111-1111-1111-111111111047', 'Regular', 24000, 1),
('11111111-1111-1111-1111-111111111048', 'Half', 10000, 1),
('11111111-1111-1111-1111-111111111048', 'Full', 15000, 2),
('11111111-1111-1111-1111-111111111049', 'Regular', 30000, 1);

-- PIZZAS (Regular Veg)
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111050', 'Onion Pizza', 'Classic onion topped pizza', 'Pizzas', '/images/pizza/onion-pizza.jpg', true),
('11111111-1111-1111-1111-111111111051', 'Tomato Pizza', 'Fresh tomato pizza', 'Pizzas', '/images/pizza/tomato-pizza.jpg', true),
('11111111-1111-1111-1111-111111111052', 'Capsicum Pizza', 'Crunchy capsicum pizza', 'Pizzas', '/images/pizza/capsicum-pizza.jpg', true),
('11111111-1111-1111-1111-111111111053', 'Sweet Corn Pizza', 'Sweet corn topped pizza', 'Pizzas', '/images/pizza/sweet-corn-pizza.jpg', true),
('11111111-1111-1111-1111-111111111054', 'Paneer Pizza', 'Paneer loaded pizza', 'Pizzas', '/images/pizza/paneer-pizza.jpg', true),
('11111111-1111-1111-1111-111111111055', 'Onion & Sweet Corn Pizza', 'Onion and sweet corn combo', 'Pizzas', '/images/pizza/onion-sweetcorn-pizza.jpg', true),
('11111111-1111-1111-1111-111111111056', 'Onion & Capsicum Pizza', 'Onion and capsicum combo', 'Pizzas', '/images/pizza/onion-capsicum-pizza.jpg', true),
('11111111-1111-1111-1111-111111111057', 'Onion & Tomato Pizza', 'Onion and tomato combo', 'Pizzas', '/images/pizza/onion-tomato-pizza.jpg', true),
('11111111-1111-1111-1111-111111111058', 'Tomato & Sweet Corn Pizza', 'Tomato and sweet corn combo', 'Pizzas', '/images/pizza/tomato-sweetcorn-pizza.jpg', true),
('11111111-1111-1111-1111-111111111059', 'Capsicum & Sweet Corn Pizza', 'Capsicum and sweet corn combo', 'Pizzas', '/images/pizza/capsicum-sweetcorn-pizza.jpg', true);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111050', 'Small', 6000, 1), ('11111111-1111-1111-1111-111111111050', 'Medium', 9000, 2),
('11111111-1111-1111-1111-111111111051', 'Small', 6000, 1), ('11111111-1111-1111-1111-111111111051', 'Medium', 9000, 2),
('11111111-1111-1111-1111-111111111052', 'Small', 6000, 1), ('11111111-1111-1111-1111-111111111052', 'Medium', 9000, 2),
('11111111-1111-1111-1111-111111111053', 'Small', 6000, 1), ('11111111-1111-1111-1111-111111111053', 'Medium', 9000, 2),
('11111111-1111-1111-1111-111111111054', 'Small', 8000, 1), ('11111111-1111-1111-1111-111111111054', 'Medium', 12000, 2),
('11111111-1111-1111-1111-111111111055', 'Small', 7000, 1), ('11111111-1111-1111-1111-111111111055', 'Medium', 10000, 2),
('11111111-1111-1111-1111-111111111056', 'Small', 7000, 1), ('11111111-1111-1111-1111-111111111056', 'Medium', 10000, 2),
('11111111-1111-1111-1111-111111111057', 'Small', 7000, 1), ('11111111-1111-1111-1111-111111111057', 'Medium', 10000, 2),
('11111111-1111-1111-1111-111111111058', 'Small', 7000, 1), ('11111111-1111-1111-1111-111111111058', 'Medium', 10000, 2),
('11111111-1111-1111-1111-111111111059', 'Small', 8000, 1), ('11111111-1111-1111-1111-111111111059', 'Medium', 12000, 2);

-- CHEESY SIDES & BREAD PIZZA
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111060', 'Single Bread Pizza', 'Crispy bread with premium toppings', 'Cheesy Sides & Bread Pizza', '/images/pizza/single-bread-pizza.jpg', false),
('11111111-1111-1111-1111-111111111061', 'Tandoori Bread Pizza', 'Tandoori spiced bread pizza', 'Cheesy Sides & Bread Pizza', '/images/pizza/tandoori-bread-pizza.jpg', false),
('11111111-1111-1111-1111-111111111062', 'Double Deck Bread Pizza', 'Double layered bread pizza', 'Cheesy Sides & Bread Pizza', '/images/pizza/double-deck-bread-pizza.jpg', false),
('11111111-1111-1111-1111-111111111063', 'Sandwich Pizza', 'Pizza meets sandwich', 'Cheesy Sides & Bread Pizza', '/images/pizza/sandwich-pizza.jpg', false),
('11111111-1111-1111-1111-111111111064', 'Cheese Garlic Bread', 'Classic cheesy garlic bread', 'Cheesy Sides & Bread Pizza', '/images/pizza/cheese-garlic-bread.jpg', true);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111060', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111061', 'Regular', 9000, 1),
('11111111-1111-1111-1111-111111111062', 'Regular', 12000, 1),
('11111111-1111-1111-1111-111111111063', 'Regular', 15000, 1),
('11111111-1111-1111-1111-111111111064', 'Half', 7000, 1),
('11111111-1111-1111-1111-111111111064', 'Full', 12000, 2);

-- MILKSHAKES
insert into public.menu_items (id, name, description, category, image_path, has_sizes) values
('11111111-1111-1111-1111-111111111070', 'Banana Milk Shake', 'Thick, creamy banana shake', 'Shake it up', '/images/milkshakes/banana-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111071', 'Mango Milk Shake', 'Fresh mango milkshake', 'Shake it up', '/images/milkshakes/mango-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111072', 'Vanilla Milk Shake', 'Classic vanilla milkshake', 'Shake it up', '/images/milkshakes/vanilla-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111073', 'Strawberry Milk Shake', 'Fresh strawberry milkshake', 'Shake it up', '/images/milkshakes/strawberry-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111074', 'Black Currant Milk Shake', 'Rich black currant shake', 'Shake it up', '/images/milkshakes/blackcurrant-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111075', 'Butter Scotch Milk Shake', 'Creamy butterscotch shake', 'Shake it up', '/images/milkshakes/butterscotch-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111076', 'Chocolate Milk Shake', 'Rich chocolate milkshake', 'Shake it up', '/images/milkshakes/chocolate-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111077', 'Oreo Milk Shake', 'Cookies and cream shake', 'Shake it up', '/images/milkshakes/oreo-milkshake.jpg', false),
('11111111-1111-1111-1111-111111111078', 'Hazelnut Milk Shake', 'Premium hazelnut shake', 'Shake it up', '/images/milkshakes/hazelnut-milkshake.jpg', false);

insert into public.menu_item_sizes (menu_item_id, size_label, price_paise, sort_order) values
('11111111-1111-1111-1111-111111111070', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111071', 'Regular', 8000, 1),
('11111111-1111-1111-1111-111111111072', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111073', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111074', 'Regular', 7000, 1),
('11111111-1111-1111-1111-111111111075', 'Regular', 8000, 1),
('11111111-1111-1111-1111-111111111076', 'Regular', 8000, 1),
('11111111-1111-1111-1111-111111111077', 'Regular', 8000, 1),
('11111111-1111-1111-1111-111111111078', 'Regular', 8000, 1);
