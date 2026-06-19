/*
  # Fix Captain Requests Foreign Key Constraint

  ## Problem
  - The `captain_requests.captain_id` field has a foreign key constraint pointing to `auth.users`
  - This is incorrect because captain_id should reference the `drivers` table, not auth.users
  - This causes errors when accepting captain requests

  ## Changes
  1. Drop the incorrect foreign key constraint
  2. Create a new correct foreign key constraint linking captain_id to drivers.id
  3. Set the constraint to SET NULL on delete (if driver is deleted, don't cascade delete requests)
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE captain_requests 
DROP CONSTRAINT IF EXISTS captain_requests_captain_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE captain_requests
ADD CONSTRAINT captain_requests_captain_id_fkey 
FOREIGN KEY (captain_id) 
REFERENCES drivers(id) 
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Create an index for better performance on captain_id lookups
CREATE INDEX IF NOT EXISTS idx_captain_requests_captain_id 
ON captain_requests(captain_id) 
WHERE captain_id IS NOT NULL;
