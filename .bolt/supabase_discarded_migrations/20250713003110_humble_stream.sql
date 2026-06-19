/*
  # Create withdrawal requests table

  1. New Tables
    - `withdrawal_requests`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, references drivers.id)
      - `amount` (numeric, not null)
      - `status` (text, default 'pending')
      - `notes` (text)
      - `processed_by` (uuid, references custom_users.id)
      - `processed_at` (timestamp with time zone)
      - `created_at` (timestamp with time zone, default now())
      - `updated_at` (timestamp with time zone, default now())
  
  2. Security
    - Enable RLS on `withdrawal_requests` table
    - Add policy for drivers to view their own requests
    - Add policy for admins to manage all requests
*/

-- Create withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  notes text,
  processed_by uuid REFERENCES custom_users(id),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_id ON withdrawal_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);

-- Enable RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Drivers can view their own withdrawal requests
CREATE POLICY "Drivers can view their own withdrawal requests"
  ON withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  ));

-- Drivers can create withdrawal requests
CREATE POLICY "Drivers can create withdrawal requests"
  ON withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (driver_id IN (
    SELECT id FROM drivers WHERE user_id = auth.uid()
  ));

-- Admins can manage all withdrawal requests
CREATE POLICY "Admins can manage all withdrawal requests"
  ON withdrawal_requests
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  ));

-- Create trigger to update updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Modify the wallet_transactions table to link to withdrawal_requests
ALTER TABLE wallet_transactions
ADD COLUMN withdrawal_request_id uuid REFERENCES withdrawal_requests(id) ON DELETE SET NULL;