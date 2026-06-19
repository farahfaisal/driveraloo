/*
  # Create driver waiting list table
  
  1. New Tables
    - driver_waiting_list
      - id (uuid, primary key)
      - order_id (uuid, references orders)
      - vendor_id (uuid, references vendors)
      - status (text) - pending, accepted, rejected
      - created_at (timestamptz)
      - updated_at (timestamptz)
      - expires_at (timestamptz) - auto expires after 30 minutes
  
  2. Security
    - Enable RLS
    - Add policies for drivers to view available orders
    - Add policies for vendors to manage their waiting list
*/

-- Create driver waiting list table
CREATE TABLE IF NOT EXISTS public.driver_waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.ord ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES public.vendors ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 minutes'
);

-- Enable RLS
ALTER TABLE public.driver_waiting_list ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_status ON public.driver_waiting_list(status);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_created_at ON public.driver_waiting_list(created_at);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_expires_at ON public.driver_waiting_list(expires_at);

-- Create policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Drivers can view available orders" ON public.driver_waiting_list;
  DROP POLICY IF EXISTS "Vendors can manage waiting list" ON public.driver_waiting_list;
  DROP POLICY IF EXISTS "Vendors can view their own waiting list orders" ON public.driver_waiting_list;

  -- Create new policies
  CREATE POLICY "Drivers can view available orders"
    ON public.driver_waiting_list
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM drivers 
        WHERE drivers.user_id = auth.uid() 
        AND drivers.status = 'pending'
      )
    );

  CREATE POLICY "Vendors can manage waiting list"
    ON public.driver_waiting_list
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM vendors v 
        WHERE v.id = driver_waiting_list.vendor_id 
        AND v.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM vendors v 
        WHERE v.id = driver_waiting_list.vendor_id 
        AND v.user_id = auth.uid()
      )
    );

  CREATE POLICY "Vendors can view their own waiting list orders"
    ON public.driver_waiting_list
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM vendors 
        WHERE vendors.id = driver_waiting_list.vendor_id 
        AND vendors.user_id = auth.uid()
      )
    );
END $$;

-- Create cleanup function for expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_waiting_list()
RETURNS void AS $$
BEGIN
  DELETE FROM public.driver_waiting_list
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cleanup
DROP TRIGGER IF EXISTS cleanup_expired_waiting_list_trigger ON public.driver_waiting_list;

CREATE TRIGGER cleanup_expired_waiting_list_trigger
  AFTER INSERT OR UPDATE ON public.driver_waiting_list
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_waiting_list();

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_driver_waiting_list_updated_at ON public.driver_waiting_list;

CREATE TRIGGER update_driver_waiting_list_updated_at
  BEFORE UPDATE ON public.driver_waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();