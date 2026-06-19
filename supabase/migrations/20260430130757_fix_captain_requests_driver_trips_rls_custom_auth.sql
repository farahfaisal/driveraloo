/*
  # Fix RLS Policies for Custom Auth (No Supabase auth.uid())

  The app uses custom authentication (not Supabase Auth), so auth.uid() always
  returns NULL. This breaks all UPDATE/INSERT policies that rely on auth.uid().

  ## Changes
  - captain_requests: Allow any public user to accept pending requests (UPDATE)
  - driver_trips: Allow public INSERT and UPDATE (custom auth app)
  - driver_waiting_list: Allow public UPDATE for drivers accepting orders
*/

-- ============================================================
-- captain_requests: fix UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "Captains can accept and update requests" ON captain_requests;
DROP POLICY IF EXISTS "Drivers can accept pending captain requests" ON captain_requests;

CREATE POLICY "Public can accept pending captain requests"
  ON captain_requests
  FOR UPDATE
  TO public
  USING (status = 'pending')
  WITH CHECK (true);

CREATE POLICY "Public can update assigned captain requests"
  ON captain_requests
  FOR UPDATE
  TO public
  USING (status IN ('assigned', 'in_progress', 'completed', 'cancelled'))
  WITH CHECK (true);

-- ============================================================
-- driver_trips: fix INSERT and UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "Drivers can insert trips" ON driver_trips;
DROP POLICY IF EXISTS "Drivers can update their own trips" ON driver_trips;

CREATE POLICY "Public can insert driver trips"
  ON driver_trips
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update driver trips"
  ON driver_trips
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- driver_waiting_list: fix UPDATE policies for drivers
-- ============================================================
DROP POLICY IF EXISTS "Drivers can accept and update waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Drivers can claim waiting list orders" ON driver_waiting_list;

CREATE POLICY "Public drivers can accept waiting list orders"
  ON driver_waiting_list
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
