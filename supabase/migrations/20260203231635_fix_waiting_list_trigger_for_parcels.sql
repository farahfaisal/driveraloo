/*
  # Fix Waiting List Trigger for Parcel Orders
  
  1. Changes
    - Update trigger to handle parcel orders differently
    - Skip order_status_history for parcel orders
  
  2. Purpose
    - Allow parcel orders to update waiting list status without errors
*/

-- Update the trigger function to handle parcel orders
CREATE OR REPLACE FUNCTION public.update_delivery_status_with_driver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_name text;
BEGIN
  -- Skip if this is a parcel order (no order_id, has parcel_order_id)
  IF NEW.parcel_order_id IS NOT NULL AND NEW.order_id IS NULL THEN
    -- Just update the status without touching order_status_history
    RETURN NEW;
  END IF;

  -- Only proceed for regular orders
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.driver_id IS NOT NULL THEN
    -- Get driver name
    SELECT name INTO v_driver_name
    FROM drivers
    WHERE id = NEW.driver_id;

    -- Only add to history if we have an order_id
    IF NEW.order_id IS NOT NULL THEN
      INSERT INTO order_status_history (
        order_id,
        status,
        created_by,
        note,
        preparation_time_minutes
      ) VALUES (
        NEW.order_id,
        'delivering',
        NEW.driver_id,
        'تم استلام الطلب من قبل السائق ' || COALESCE(v_driver_name, ''),
        0
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update the handle_parcel_order_acceptance function to use 'accepted' status
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
        status = 'accepted',
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

-- Now update the waiting list for the existing parcel
UPDATE driver_waiting_list
SET 
  status = 'accepted',
  driver_id = 'cb4021aa-9a79-4eae-b371-e0469af0eeb0',
  updated_at = NOW()
WHERE parcel_order_id = '480df457-eb57-49d8-9ce2-0c2cd8c16f5d'
  AND status = 'pending';