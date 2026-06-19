/*
  # Create driver waiting list table

  1. New Tables
    - `driver_waiting_list` table for storing orders waiting for drivers
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `status` (text: pending, accepted, rejected)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on driver_waiting_list table
    - Add policies for order access
    - Create indexes for performance
*/

-- Create driver_waiting_list table
CREATE TABLE IF NOT EXISTS public.driver_waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_waiting_list ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_order_id ON public.driver_waiting_list(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_status ON public.driver_waiting_list(status);

-- Create policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Orders are viewable by available drivers" ON public.driver_waiting_list;
  DROP POLICY IF EXISTS "Orders can be updated by available drivers" ON public.driver_waiting_list;
  
  -- Create new policies
  CREATE POLICY "Orders are viewable by available drivers"
    ON public.driver_waiting_list
    FOR SELECT
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.drivers
      WHERE drivers.user_id = auth.uid()
      AND drivers.status = 'available'
    ));

  CREATE POLICY "Orders can be updated by available drivers"
    ON public.driver_waiting_list
    FOR UPDATE
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.drivers
      WHERE drivers.user_id = auth.uid()
      AND drivers.status = 'available'
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.drivers
      WHERE drivers.user_id = auth.uid()
      AND drivers.status = 'available'
    ));
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_driver_waiting_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_waiting_list_updated_at
  BEFORE UPDATE ON public.driver_waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_waiting_list_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.driver_waiting_list IS 'Tracks orders waiting for driver assignment';
COMMENT ON COLUMN public.driver_waiting_list.order_id IS 'Reference to the order';
COMMENT ON COLUMN public.driver_waiting_list.status IS 'Current status of the waiting order';