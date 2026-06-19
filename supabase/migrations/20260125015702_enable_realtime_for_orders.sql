/*
  # Enable Realtime for Order Tables

  1. Changes
    - Enable realtime publication for captain_requests table
    - Enable realtime publication for driver_waiting_list table
    - This allows drivers to receive instant updates when orders are accepted by other drivers

  2. Notes
    - Realtime subscriptions will automatically update the order list
    - When a driver accepts an order, other drivers will see it disappear instantly
    - No data migration needed, only enabling realtime feature
*/

-- Enable realtime for captain_requests
ALTER PUBLICATION supabase_realtime ADD TABLE captain_requests;

-- Enable realtime for driver_waiting_list
ALTER PUBLICATION supabase_realtime ADD TABLE driver_waiting_list;