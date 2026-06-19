/*
  # Cleanup Orphaned Waiting List Entries
  
  1. Changes
    - Remove entries from driver_waiting_list where order_id doesn't exist in orders table
    - Add foreign key constraint to prevent this in future
  
  2. Purpose
    - Fix data integrity issue where waiting list has orders that don't exist
    - Prevent foreign key errors when creating driver trips
*/

-- Delete orphaned entries (where order_id doesn't exist in orders table)
DELETE FROM driver_waiting_list
WHERE order_id IS NOT NULL
  AND order_id NOT IN (SELECT id FROM orders);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'driver_waiting_list_order_id_fkey'
    AND table_name = 'driver_waiting_list'
  ) THEN
    ALTER TABLE driver_waiting_list
    ADD CONSTRAINT driver_waiting_list_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE;
  END IF;
END $$;