/*
  # Update wallet transactions schema

  1. Changes
    - Add check constraints for payment_type and status columns
    - Add performance indexes
    - Add safe balance increment function

  2. Security
    - Maintains existing RLS policies
    - Adds data validation through check constraints
*/

-- Add check constraints if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wallet_transactions_payment_type_check'
  ) THEN
    ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_payment_type_check 
    CHECK (payment_type IN ('commission', 'withdrawal', 'system_fee', 'bonus'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wallet_transactions_status_check'
  ) THEN
    ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));
  END IF;
END $$;

-- Add indexes for better performance if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_wallet_transactions_payment_type'
  ) THEN
    CREATE INDEX idx_wallet_transactions_payment_type ON wallet_transactions(payment_type);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_wallet_transactions_status'
  ) THEN
    CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
  END IF;
END $$;

-- Function to safely increment wallet balance
CREATE OR REPLACE FUNCTION increment_wallet_balance(wallet_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE driver_wallets
  SET balance = balance + amount,
      total_earnings = CASE 
        WHEN amount > 0 THEN total_earnings + amount
        ELSE total_earnings
      END,
      updated_at = now()
  WHERE id = wallet_id;
END;
$$;