-- Run this in your Supabase SQL Editor:

-- 0. Setup User Roles Type and Role Column on Profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin');
  END IF;
END
$$;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'customer'::user_role;

-- 1. Extend orders table to support delivery types and assignments
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'takeaway' CHECK (delivery_type IN ('dine_in', 'takeaway', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'unassigned' CHECK (delivery_status IN ('unassigned', 'assigned', 'picked_up', 'delivered')),
  ADD COLUMN IF NOT EXISTS delivery_boy_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS pin_adjusted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(6);

-- 2. Create a delivery boy status profile table
CREATE TABLE IF NOT EXISTS delivery_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for delivery_profiles
ALTER TABLE delivery_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active delivery profiles" ON delivery_profiles;
CREATE POLICY "Anyone can view active delivery profiles"
  ON delivery_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage their own delivery profile" ON delivery_profiles;
CREATE POLICY "Users can manage their own delivery profile"
  ON delivery_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Create a real-time GPS coordinates stream table
CREATE TABLE IF NOT EXISTS delivery_locations (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  delivery_boy_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  heading NUMERIC(5, 2),
  speed NUMERIC(5, 2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for delivery_locations
ALTER TABLE delivery_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assigned drivers can upsert their location" ON delivery_locations;
CREATE POLICY "Assigned drivers can upsert their location"
  ON delivery_locations FOR ALL TO authenticated 
  USING (auth.uid() = delivery_boy_id)
  WITH CHECK (auth.uid() = delivery_boy_id);

DROP POLICY IF EXISTS "Customers can view driver locations for their orders" ON delivery_locations;
CREATE POLICY "Customers can view driver locations for their orders"
  ON delivery_locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = delivery_locations.order_id 
        AND orders.user_id = auth.uid()
    )
  );

-- Create index on delivery_boy_id for location updates
CREATE INDEX IF NOT EXISTS delivery_locations_driver_idx ON delivery_locations (delivery_boy_id);
