/*
  # Create driver trips table and related functions

  1. New Tables
    - `driver_trips` - Stores completed delivery trips
      - `id` (uuid, primary key)
      - `order_id` (uuid, references orders)
      - `driver_id` (uuid, references drivers)
      - `status` (text) - Status of the trip (assigned, in_progress, completed, cancelled)
      - `customer_name` (text)
      - `customer_phone` (text)
      - `pickup_address` (text)
      - `delivery_address` (text)
      - `total` (numeric)
      - `payment_method` (text)
      - `notes` (text)
      - Various timestamps for tracking trip progress

  2. Security
    - Enable RLS
    - Add policies for drivers to manage their trips
    - Add policies for vendors to view trips for their orders

  3. Triggers
    - Add trigger to update trip status when order status changes
*/

-- Create driver_trips table
CREATE TABLE IF NOT EXISTS driver_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
  customer_name text,
  customer_phone text,
  pickup_address text,
  delivery_address text,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  payment_method text,
  notes text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_trips_driver_id ON driver_trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_trips_order_id ON driver_trips(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_trips_status ON driver_trips(status);
CREATE INDEX IF NOT EXISTS idx_driver_trips_assigned_at ON driver_trips(assigned_at);

-- Enable RLS
ALTER TABLE driver_trips ENABLE ROW LEVEL SECURITY;

-- Policies for drivers
CREATE POLICY "Drivers can view their own trips"
  ON driver_trips
  FOR SELECT
  TO authenticated
  USING (
    driver_id = uid() OR
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_trips.driver_id
      AND drivers.user_id = uid()
    )
  );

CREATE POLICY "Drivers can update their own trips"
  ON driver_trips
  FOR UPDATE
  TO authenticated
  USING (
    driver_id = uid() OR
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_trips.driver_id
      AND drivers.user_id = uid()
    )
  )
  WITH CHECK (
    driver_id = uid() OR
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = driver_trips.driver_id
      AND drivers.user_id = uid()
    )
  );

-- Policies for vendors
CREATE POLICY "Vendors can view trips for their orders"
  ON driver_trips
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN vendors ON vendors.id = orders.vendor_id
      WHERE orders.id = driver_trips.order_id
      AND vendors.user_id = uid()
    )
  );

-- Function to handle trip status updates
CREATE OR REPLACE FUNCTION update_trip_status()
RETURNS trigger AS $$
BEGIN
  -- Update timestamps based on status change
  IF NEW.status = 'in_progress' AND OLD.status = 'assigned' THEN
    NEW.started_at = now();
  ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trip status updates
CREATE TRIGGER update_trip_status_trigger
  BEFORE UPDATE OF status ON driver_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_trip_status();

-- Function to create trip when order is assigned to driver
CREATE OR REPLACE FUNCTION create_driver_trip()
RETURNS trigger AS $$
BEGIN
  -- When an order is assigned to a driver
  IF NEW.driver_id IS NOT NULL AND OLD.driver_id IS NULL THEN
    INSERT INTO driver_trips (
      order_id,
      driver_id,
      customer_name,
      customer_phone,
      pickup_address,
      delivery_address,
      total,
      payment_method,
      notes
    )
    VALUES (
      NEW.id,
      NEW.driver_id,
      NEW.customer_name,
      NEW.customer_phone,
      (SELECT store_name FROM vendors WHERE id = NEW.vendor_id),
      NEW.address,
      NEW.total,
      NEW.payment_method,
      NEW.notes
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create trip when order is assigned
CREATE TRIGGER create_driver_trip_trigger
  AFTER UPDATE OF driver_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_driver_trip();