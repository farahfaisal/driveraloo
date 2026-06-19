/*
  # Complete Parcel Order Support for Driver Trips
  
  1. Changes
    - Add parcel_order_id column to driver_trips
    - Update check constraint
    - Create foreign key
    - Update functions and triggers
    - Populate existing data
  
  2. Purpose
    - Full integration of parcel orders with driver trips
*/

-- Step 1: Add parcel_order_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_trips' AND column_name = 'parcel_order_id'
  ) THEN
    ALTER TABLE driver_trips ADD COLUMN parcel_order_id uuid;
    RAISE NOTICE 'Added parcel_order_id column';
  ELSE
    RAISE NOTICE 'parcel_order_id column already exists';
  END IF;
END $$;

-- Step 2: Drop old constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'driver_trips_order_or_captain_check'
  ) THEN
    ALTER TABLE driver_trips DROP CONSTRAINT driver_trips_order_or_captain_check;
    RAISE NOTICE 'Dropped old constraint';
  END IF;
END $$;

-- Step 3: Add new constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'driver_trips_order_or_captain_or_parcel_check'
  ) THEN
    ALTER TABLE driver_trips
    ADD CONSTRAINT driver_trips_order_or_captain_or_parcel_check
    CHECK (
      (order_id IS NOT NULL) OR 
      (captain_request_id IS NOT NULL) OR 
      (parcel_order_id IS NOT NULL)
    );
    RAISE NOTICE 'Added new constraint';
  END IF;
END $$;

-- Step 4: Add foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'driver_trips_parcel_order_id_fkey'
  ) THEN
    ALTER TABLE driver_trips
    ADD CONSTRAINT driver_trips_parcel_order_id_fkey
    FOREIGN KEY (parcel_order_id) REFERENCES parcel_orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key';
  END IF;
END $$;

-- Step 5: Create index
CREATE INDEX IF NOT EXISTS idx_driver_trips_parcel_order_id ON driver_trips(parcel_order_id);

-- Step 6: Update auto_add_to_waiting_list function
CREATE OR REPLACE FUNCTION public.auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_TABLE_NAME = 'parcel_orders' THEN
    INSERT INTO driver_waiting_list (
      parcel_order_id,
      customer_name,
      customer_phone,
      address,
      total,
      status,
      created_at,
      updated_at,
      order_number,
      vendor_name,
      notes
    ) VALUES (
      NEW.id,
      NEW.receiver_name,
      NEW.receiver_phone,
      NEW.receiver_address,
      NEW.delivery_fee,
      'pending',
      NOW(),
      NOW(),
      NEW.order_number,
      NEW.sender_name || ' (مُرسِل)',
      COALESCE(NEW.description, NEW.notes)
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 7: Create function for parcel acceptance
CREATE OR REPLACE FUNCTION public.handle_parcel_order_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_waiting_list_id uuid;
  v_trip_id uuid;
BEGIN
  IF NEW.status = 'accepted' AND NEW.driver_id IS NOT NULL 
     AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    
    -- Update waiting list
    SELECT id INTO v_waiting_list_id
    FROM driver_waiting_list
    WHERE parcel_order_id = NEW.id;
    
    IF v_waiting_list_id IS NOT NULL THEN
      UPDATE driver_waiting_list
      SET 
        driver_id = NEW.driver_id,
        status = 'assigned',
        updated_at = NOW()
      WHERE id = v_waiting_list_id;
    END IF;
    
    -- Create driver trip
    IF NOT EXISTS (
      SELECT 1 FROM driver_trips WHERE parcel_order_id = NEW.id
    ) THEN
      INSERT INTO driver_trips (
        parcel_order_id,
        order_number,
        driver_id,
        status,
        customer_name,
        customer_phone,
        pickup_address,
        delivery_address,
        total,
        notes,
        assigned_at,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        NEW.driver_id,
        'assigned',
        NEW.receiver_name,
        NEW.receiver_phone,
        NEW.sender_address,
        NEW.receiver_address,
        NEW.delivery_fee,
        COALESCE(NEW.description, NEW.notes, 'طلب طرد'),
        COALESCE(NEW.accepted_at, NOW()),
        NOW(),
        NOW()
      )
      RETURNING id INTO v_trip_id;
      
      RAISE NOTICE 'Created driver trip % for parcel %', v_trip_id, NEW.order_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 8: Create trigger
DROP TRIGGER IF EXISTS trigger_handle_parcel_acceptance ON parcel_orders;
CREATE TRIGGER trigger_handle_parcel_acceptance
  AFTER UPDATE ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_parcel_order_acceptance();

-- Step 9: Update existing waiting list entries
UPDATE driver_waiting_list dwl
SET 
  customer_name = po.receiver_name,
  customer_phone = po.receiver_phone,
  address = po.receiver_address,
  vendor_name = po.sender_name || ' (مُرسِل)',
  notes = COALESCE(po.description, po.notes),
  order_number = po.order_number,
  updated_at = NOW()
FROM parcel_orders po
WHERE dwl.parcel_order_id = po.id
  AND (dwl.customer_name IS NULL OR dwl.customer_phone IS NULL OR dwl.order_number IS NULL);

-- Step 10: Create trip for existing accepted parcel
INSERT INTO driver_trips (
  parcel_order_id,
  order_number,
  driver_id,
  status,
  customer_name,
  customer_phone,
  pickup_address,
  delivery_address,
  total,
  notes,
  assigned_at,
  created_at,
  updated_at
)
SELECT 
  po.id,
  po.order_number,
  po.driver_id,
  'assigned',
  po.receiver_name,
  po.receiver_phone,
  po.sender_address,
  po.receiver_address,
  po.delivery_fee,
  COALESCE(po.description, po.notes, 'طلب طرد'),
  COALESCE(po.accepted_at, NOW()),
  NOW(),
  NOW()
FROM parcel_orders po
WHERE po.status = 'accepted'
  AND po.driver_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_trips dt WHERE dt.parcel_order_id = po.id
  );