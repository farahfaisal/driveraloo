/*
  # Add 'preparing' status to driver_waiting_list

  1. Changes
    - Update the CHECK constraint on driver_waiting_list.status to include 'preparing'
    - This allows orders in "preparing" state to be shown to drivers
  
  2. Why
    - Currently, only orders with status 'pending', 'preparing_pending_vendor', 'accepted', 'ready', or 'rejected' are allowed
    - We need to add 'preparing' so drivers can see orders that are being prepared
*/

-- Drop the old constraint
ALTER TABLE driver_waiting_list DROP CONSTRAINT IF EXISTS driver_waiting_list_status_check;

-- Add the new constraint with 'preparing' included
ALTER TABLE driver_waiting_list ADD CONSTRAINT driver_waiting_list_status_check 
CHECK (status = ANY (ARRAY['preparing_pending_vendor'::text, 'pending'::text, 'preparing'::text, 'accepted'::text, 'ready'::text, 'rejected'::text]));
