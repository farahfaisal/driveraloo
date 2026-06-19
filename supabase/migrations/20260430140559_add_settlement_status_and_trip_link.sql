/*
  # Add settlement_status and trip reference to driver_settlements

  ## Summary
  This migration adds support for per-trip automatic settlements with a pending/completed status flow.

  ## Changes

  ### Modified Table: driver_settlements
  - Add `settlement_status` (text): 'pending' when auto-created on trip completion, 'completed' when admin marks as paid
  - Add `trip_id` (uuid, nullable): links this settlement record directly to the driver_trip that generated it
  - Add `order_number` (text, nullable): human-readable order reference for display

  ## Notes
  - Existing records default to 'completed' since they were already settled manually
  - New auto-created settlements will start as 'pending'
  - Admin changes status to 'completed' to confirm payment
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_settlements' AND column_name = 'settlement_status'
  ) THEN
    ALTER TABLE driver_settlements ADD COLUMN settlement_status text NOT NULL DEFAULT 'completed'
      CHECK (settlement_status IN ('pending', 'completed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_settlements' AND column_name = 'trip_id'
  ) THEN
    ALTER TABLE driver_settlements ADD COLUMN trip_id uuid REFERENCES driver_trips(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_settlements' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE driver_settlements ADD COLUMN order_number text;
  END IF;
END $$;

-- Index for fast lookups by trip_id
CREATE INDEX IF NOT EXISTS idx_driver_settlements_trip_id ON driver_settlements(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_settlements_status ON driver_settlements(settlement_status);
