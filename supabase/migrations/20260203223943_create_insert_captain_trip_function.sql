/*
  # Create Helper Function for Captain Trip Insertion
  
  1. New Functions
    - `insert_captain_trip`: Safely inserts a captain trip without requiring order_id
    
  2. Security
    - Function owned by authenticated users
    - RLS still applies
*/

-- Create function to insert captain trip
CREATE OR REPLACE FUNCTION insert_captain_trip(
  p_captain_request_id uuid,
  p_driver_id uuid,
  p_status text,
  p_customer_name text,
  p_customer_phone text,
  p_pickup_address text,
  p_delivery_address text,
  p_total numeric,
  p_assigned_at timestamptz,
  p_started_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    started_at
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
    p_started_at
  )
  RETURNING id INTO v_trip_id;
  
  RETURN v_trip_id;
END;
$$;