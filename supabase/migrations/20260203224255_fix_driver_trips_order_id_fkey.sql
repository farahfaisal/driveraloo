/*
  # Fix Foreign Key Constraint for driver_trips.order_id
  
  1. Changes
    - Drop existing foreign key constraint on order_id
    - Recreate it with proper NULL handling
    - This allows captain trips to exist without order_id
  
  2. Security
    - Maintains referential integrity for regular orders
    - Allows NULL for captain requests
*/

-- Drop the existing foreign key constraint
ALTER TABLE driver_trips 
DROP CONSTRAINT IF EXISTS driver_trips_order_id_fkey;

-- Recreate the foreign key constraint with proper NULL handling
ALTER TABLE driver_trips
ADD CONSTRAINT driver_trips_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE CASCADE
NOT VALID;

-- Validate the constraint
ALTER TABLE driver_trips 
VALIDATE CONSTRAINT driver_trips_order_id_fkey;