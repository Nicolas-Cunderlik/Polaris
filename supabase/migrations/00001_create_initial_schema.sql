-- Create user role enum
CREATE TYPE public.user_role AS ENUM ('operator', 'provider', 'admin');

-- Create drone status enum
CREATE TYPE public.drone_status AS ENUM ('idle', 'flying', 'charging', 'en_route');

-- Create companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wallet_address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create profiles table (synced with auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  username text UNIQUE,
  role public.user_role DEFAULT 'operator'::public.user_role,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create nodes table (charging infrastructure)
CREATE TABLE public.nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat numeric(10, 7) NOT NULL,
  lng numeric(10, 7) NOT NULL,
  capacity integer NOT NULL DEFAULT 5,
  current_load integer NOT NULL DEFAULT 0,
  owner_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create drones table
CREATE TABLE public.drones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  lat numeric(10, 7) NOT NULL,
  lng numeric(10, 7) NOT NULL,
  battery numeric(5, 2) NOT NULL DEFAULT 100.00,
  status public.drone_status DEFAULT 'idle'::public.drone_status,
  destination_lat numeric(10, 7),
  destination_lng numeric(10, 7),
  current_node_id uuid REFERENCES public.nodes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table (payment logs)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid REFERENCES public.drones(id) ON DELETE CASCADE,
  node_id uuid REFERENCES public.nodes(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  amount_sol numeric(10, 6) NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- Create function to sync auth.users to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  INSERT INTO public.profiles (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'operator'::public.user_role END
  );
  RETURN NEW;
END;
$$;

-- Create trigger for user sync
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Create helper function for admin check
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- Enable realtime for drones and transactions
ALTER PUBLICATION supabase_realtime ADD TABLE drones;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;

-- RLS Policies for companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view companies" ON public.companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage companies" ON public.companies
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to profiles" ON public.profiles
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- RLS Policies for nodes
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view nodes" ON public.nodes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Providers can create nodes" ON public.nodes
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'provider'::user_role OR role = 'admin'::user_role)
    )
  );

CREATE POLICY "Providers can update their nodes" ON public.nodes
  FOR UPDATE TO authenticated 
  USING (
    owner_company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR is_admin(auth.uid())
  );

-- RLS Policies for drones
ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view drones" ON public.drones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators can manage their company drones" ON public.drones
  FOR ALL TO authenticated 
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR is_admin(auth.uid())
  );

-- RLS Policies for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view transactions" ON public.transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can create transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert seed data for companies
INSERT INTO public.companies (name, wallet_address) VALUES
  ('SkyLogistics', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
  ('AeroDelivery', '9vYWHBPz4C5QqEXk2uEg4X2kqk9Z7YjVjKqk5Z7YjVjK'),
  ('CloudCargo', 'BnRtg5CW87d97TXJSDpbD5jBkheTqA83TZRuJosgBsV');

-- Insert seed data for nodes (San Francisco Bay Area)
INSERT INTO public.nodes (name, lat, lng, capacity, owner_company_id) VALUES
  ('Node-SF-01', 37.7749, -122.4194, 8, (SELECT id FROM companies WHERE name = 'SkyLogistics')),
  ('Node-SF-02', 37.7849, -122.4094, 6, (SELECT id FROM companies WHERE name = 'AeroDelivery')),
  ('Node-OAK-01', 37.8044, -122.2712, 10, (SELECT id FROM companies WHERE name = 'CloudCargo')),
  ('Node-SJ-01', 37.3382, -121.8863, 7, (SELECT id FROM companies WHERE name = 'SkyLogistics')),
  ('Node-PA-01', 37.4419, -122.1430, 5, (SELECT id FROM companies WHERE name = 'AeroDelivery'));

-- Insert seed data for drones
INSERT INTO public.drones (name, company_id, lat, lng, battery, status) VALUES
  ('Drone-SL-001', (SELECT id FROM companies WHERE name = 'SkyLogistics'), 37.7749, -122.4194, 85.5, 'idle'),
  ('Drone-SL-002', (SELECT id FROM companies WHERE name = 'SkyLogistics'), 37.7849, -122.4094, 92.3, 'flying'),
  ('Drone-SL-003', (SELECT id FROM companies WHERE name = 'SkyLogistics'), 37.8044, -122.2712, 45.8, 'charging'),
  ('Drone-AD-001', (SELECT id FROM companies WHERE name = 'AeroDelivery'), 37.3382, -121.8863, 78.2, 'idle'),
  ('Drone-AD-002', (SELECT id FROM companies WHERE name = 'AeroDelivery'), 37.4419, -122.1430, 65.4, 'flying'),
  ('Drone-CC-001', (SELECT id FROM companies WHERE name = 'CloudCargo'), 37.7749, -122.4194, 88.9, 'idle'),
  ('Drone-CC-002', (SELECT id FROM companies WHERE name = 'CloudCargo'), 37.7849, -122.4094, 34.2, 'en_route');