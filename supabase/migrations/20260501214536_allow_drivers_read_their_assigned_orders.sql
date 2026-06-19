/*
  # Allow drivers to read orders assigned to them

  ## Problem
  Drivers could not read order details (notes, coupon_discount, subtotal, etc.)
  because no RLS SELECT policy existed for drivers on the orders table.
  This caused getDriverTrips() to return empty orders array, so all order
  details (notes, discounts, preparation times) were missing in MyTrips.

  ## Change
  Add a SELECT policy that allows a driver to read any order that has a
  corresponding driver_trip assigned to them.
*/

CREATE POLICY "Drivers can view orders assigned to their trips"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_trips dt
      JOIN drivers d ON d.id = dt.driver_id
      WHERE dt.order_id = orders.id
        AND d.user_id = auth.uid()
    )
  );
