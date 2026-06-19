/*
  # Add wallet tables

  1. New Tables
    - `driver_wallets`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, references drivers)
      - `balance` (numeric)
      - `total_earnings` (numeric)
      - `total_withdrawals` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `wallet_id` (uuid, references driver_wallets)
      - `amount` (numeric)
      - `type` (text: credit/debit)
      - `description` (text)
      - `order_id` (uuid, references ord)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for drivers to view their own wallet data
*/

-- Create driver_wallets table
CREATE TABLE IF NOT EXISTS public.driver_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  balance numeric(10,2) DEFAULT 0.00 CHECK (balance >= 0),
  total_earnings numeric(10,2) DEFAULT 0.00 CHECK (total_earnings >= 0),
  total_withdrawals numeric(10,2) DEFAULT 0.00 CHECK (total_withdrawals >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.driver_wallets(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text NOT NULL,
  order_id uuid REFERENCES public.ord(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_wallets_driver_id ON public.driver_wallets(driver_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON public.wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at);

-- Create policies for driver_wallets
CREATE POLICY "Drivers can view their own wallet"
  ON public.driver_wallets
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.drivers
    WHERE drivers.id = driver_wallets.driver_id
    AND drivers.user_id = auth.uid()
  ));

-- Create policies for wallet_transactions
CREATE POLICY "Drivers can view their wallet transactions"
  ON public.wallet_transactions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.driver_wallets
    JOIN public.drivers ON drivers.id = driver_wallets.driver_id
    WHERE driver_wallets.id = wallet_transactions.wallet_id
    AND drivers.user_id = auth.uid()
  ));

-- Create trigger for updating updated_at
CREATE TRIGGER update_driver_wallets_updated_at
  BEFORE UPDATE ON public.driver_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();