/*
  # Fix wallet_transactions foreign key constraint

  1. Changes
    - Clean up orphaned wallet_transactions records
    - Drop incorrect foreign key constraint to vendor_wallets
    - Add correct foreign key constraint to driver_wallets

  2. Security
    - Maintains data integrity by removing orphaned records
    - Ensures proper foreign key relationships
*/

-- First, remove any orphaned wallet_transactions that don't have corresponding driver_wallets
DELETE FROM wallet_transactions 
WHERE wallet_id NOT IN (
  SELECT id FROM driver_wallets
);

-- Drop the incorrect foreign key constraint if it exists
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS wallet_transactions_wallet_id_fkey;

-- Add the correct foreign key constraint to reference driver_wallets
ALTER TABLE wallet_transactions 
ADD CONSTRAINT wallet_transactions_wallet_id_fkey 
FOREIGN KEY (wallet_id) REFERENCES driver_wallets(id) ON DELETE CASCADE;

-- Add index for better performance if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_wallet_transactions_wallet_id'
  ) THEN
    CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
  END IF;
END $$;