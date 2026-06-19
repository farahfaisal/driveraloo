/*
  # Fix UNIQUE Constraint on driver_trips.order_id
  
  1. Changes
    - Drop the UNIQUE constraint on order_id
    - Add a PARTIAL UNIQUE constraint that only applies to non-NULL values
    - This allows multiple captain trips with NULL order_id
  
  2. Security
    - Maintains uniqueness for regular orders (one trip per order)
    - Allows multiple captain trips without order_id
*/

-- Drop the existing unique constraint
ALTER TABLE driver_trips 
DROP CONSTRAINT IF EXISTS driver_trips_order_id_key;

-- Add a partial unique constraint (only for non-NULL order_id)
CREATE UNIQUE INDEX driver_trips_order_id_unique_idx 
ON driver_trips (order_id) 
WHERE order_id IS NOT NULL;