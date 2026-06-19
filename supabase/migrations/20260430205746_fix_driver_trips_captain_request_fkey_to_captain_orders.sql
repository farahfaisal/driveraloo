/*
  # Fix driver_trips captain_request_id foreign key

  The captain_request_id column in driver_trips incorrectly references captain_requests table.
  Since captain orders are stored in captain_orders table, we need to:
  1. Drop the old FK constraint pointing to captain_requests
  2. Add new FK constraint pointing to captain_orders
*/

ALTER TABLE driver_trips
  DROP CONSTRAINT IF EXISTS driver_trips_captain_request_id_fkey;

ALTER TABLE driver_trips
  ADD CONSTRAINT driver_trips_captain_request_id_fkey
  FOREIGN KEY (captain_request_id)
  REFERENCES captain_orders(id)
  ON DELETE SET NULL;
