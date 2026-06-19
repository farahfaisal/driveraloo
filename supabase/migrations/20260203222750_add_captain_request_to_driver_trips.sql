/*
  # Add Captain Request Support to Driver Trips
  
  1. Schema Changes
    - Add `captain_request_id` column to `driver_trips` table (nullable, references captain_requests)
    - Make `order_id` column nullable to support both captain requests and store orders
    - Add check constraint to ensure at least one of order_id or captain_request_id is present
    
  2. Security
    - Maintain existing RLS policies
    - Add foreign key constraint for captain_request_id
*/

-- Add captain_request_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_trips' AND column_name = 'captain_request_id'
  ) THEN
    ALTER TABLE driver_trips ADD COLUMN captain_request_id uuid REFERENCES captain_requests(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_driver_trips_captain_request_id ON driver_trips(captain_request_id);
  END IF;
END $$;

-- Make order_id nullable
DO $$
BEGIN
  ALTER TABLE driver_trips ALTER COLUMN order_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'order_id already nullable or error: %', SQLERRM;
END $$;

-- Add constraint to ensure at least one of order_id or captain_request_id is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_trips_order_or_captain_check'
  ) THEN
    ALTER TABLE driver_trips 
    ADD CONSTRAINT driver_trips_order_or_captain_check 
    CHECK (order_id IS NOT NULL OR captain_request_id IS NOT NULL);
  END IF;
END $$;