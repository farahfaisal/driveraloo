/*
  # Create web_push_subscriptions Table

  Stores browser Web Push API subscription objects for PWA drivers.
  These are different from FCM tokens (used by native Android/iOS apps).

  1. New Tables
    - `web_push_subscriptions`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, FK to drivers)
      - `endpoint` (text, unique per driver - the push service URL)
      - `p256dh` (text - client public key for encryption)
      - `auth` (text - auth secret for encryption)
      - `is_active` (boolean)
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - RLS enabled, open policies (custom auth app - no Supabase auth.uid())
*/

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(driver_id, endpoint)
);

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select web_push_subscriptions"
  ON web_push_subscriptions FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert web_push_subscriptions"
  ON web_push_subscriptions FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update web_push_subscriptions"
  ON web_push_subscriptions FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete web_push_subscriptions"
  ON web_push_subscriptions FOR DELETE TO public USING (true);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_driver_id ON web_push_subscriptions(driver_id);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_active ON web_push_subscriptions(is_active) WHERE is_active = true;
