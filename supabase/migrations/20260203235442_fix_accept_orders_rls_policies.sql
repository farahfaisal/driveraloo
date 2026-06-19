/*
  # Fix RLS Policies for Accepting Captain Requests and Parcel Orders

  ## Changes
  
  1. **Captain Requests**
     - Add policy to allow drivers to accept pending captain requests
     - Allow drivers to update captain_id, status, and timestamps for pending requests
  
  2. **Parcel Orders**
     - Add policy to allow drivers to accept pending parcel orders
     - Allow drivers to update driver_id, status, and timestamps for pending orders
  
  ## Security
  - Drivers can only accept pending orders (not modify already assigned/completed orders)
  - Must be authenticated and exist in drivers table
*/

-- ============================================================================
-- CAPTAIN REQUESTS POLICIES
-- ============================================================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can update own pending requests" ON captain_requests;

-- Allow drivers to accept pending captain requests
CREATE POLICY "Drivers can accept pending captain requests"
  ON captain_requests
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PARCEL ORDERS POLICIES
-- ============================================================================

-- Allow drivers to accept pending parcel orders
CREATE POLICY "Drivers can accept pending parcel orders"
  ON parcel_orders
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.user_id = auth.uid()
    )
  );
