/*
  # Add Order Number to Driver Trips
  
  1. Changes
    - Add order_number column to driver_trips table
    - Populate existing trips with order numbers from orders table
    - Update function to copy order_number when creating trips
  
  2. Purpose
    - Display the same order number in trips that customers see
    - Make it easier to track and reference orders
*/

-- Add order_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_trips' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE driver_trips ADD COLUMN order_number text;
  END IF;
END $$;

-- Populate existing trips with order numbers from orders table
UPDATE driver_trips dt
SET order_number = o.order_number
FROM orders o
WHERE dt.order_id = o.id
  AND dt.order_number IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_trips_order_number ON driver_trips(order_number);

-- Update the insert_captain_trip function to accept order_number
CREATE OR REPLACE FUNCTION public.insert_captain_trip(
  p_captain_request_id uuid,
  p_driver_id uuid,
  p_status text,
  p_customer_name text,
  p_customer_phone text,
  p_pickup_address text,
  p_delivery_address text,
  p_total numeric,
  p_assigned_at timestamp with time zone,
  p_started_at timestamp with time zone DEFAULT NULL,
  p_order_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_trip_id uuid;
BEGIN
  INSERT INTO driver_trips (
    captain_request_id,
    driver_id,
    status,
    customer_name,
    customer_phone,
    pickup_address,
    delivery_address,
    total,
    assigned_at,
    started_at,
    order_number
  ) VALUES (
    p_captain_request_id,
    p_driver_id,
    p_status,
    p_customer_name,
    p_customer_phone,
    p_pickup_address,
    p_delivery_address,
    p_total,
    p_assigned_at,
    p_started_at,
    p_order_number
  )
  RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END;
$function$;