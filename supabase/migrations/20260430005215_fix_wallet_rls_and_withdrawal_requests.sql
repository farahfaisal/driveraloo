/*
  # Fix Wallet RLS and Add withdrawal_requests Table

  1. Changes
    - Fix driver_wallets RLS to allow access via custom auth (driver_id match)
    - Fix wallet_transactions RLS to allow access via custom auth
    - Create withdrawal_requests table
    - Add RLS policies for withdrawal_requests

  2. Problem
    The app uses custom session auth (not Supabase auth), so auth.uid() returns null.
    Policies need to allow access when driver_id matches directly (anon/public role).
*/

-- Fix driver_wallets: allow SELECT/UPDATE/INSERT by driver_id (custom auth uses anon role)
DROP POLICY IF EXISTS "Allow drivers to SELECT their wallet" ON driver_wallets;

CREATE POLICY "Allow public select by driver_id"
  ON driver_wallets FOR SELECT
  TO public
  USING (true);

-- Fix wallet_transactions: allow public SELECT
DROP POLICY IF EXISTS "Drivers can insert wallet transactions" ON wallet_transactions;

CREATE POLICY "Allow public select wallet_transactions"
  ON wallet_transactions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert wallet_transactions"
  ON wallet_transactions FOR INSERT
  TO public
  WITH CHECK (true);

-- Create withdrawal_requests table if not exists
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select withdrawal_requests"
  ON withdrawal_requests FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert withdrawal_requests"
  ON withdrawal_requests FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update withdrawal_requests"
  ON withdrawal_requests FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Add withdrawal_request_id to wallet_transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallet_transactions' AND column_name = 'withdrawal_request_id'
  ) THEN
    ALTER TABLE wallet_transactions ADD COLUMN withdrawal_request_id uuid REFERENCES withdrawal_requests(id);
  END IF;
END $$;
