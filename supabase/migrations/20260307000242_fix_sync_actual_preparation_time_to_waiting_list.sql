/*
  # إصلاح مزامنة وقت التحضير الفعلي إلى قائمة انتظار السائقين
  
  ## المشكلة
  - البائع يحدد وقت التحضير في actual_preparation_time
  - لكن هذا الوقت لا يظهر في driver_waiting_list
  - السبب: actual_preparation_time لا يتم نسخه عند إضافة الطلب لقائمة الانتظار
  
  ## الحل
  1. تحديث الدالة sync_order_to_waiting_list لنسخ actual_preparation_time
  2. تحديث الدالة insert_captain_trip لنسخ actual_preparation_time
  3. تحديث البيانات الموجودة لمزامنة actual_preparation_time
*/

-- Update sync_order_to_waiting_list function to copy actual_preparation_time
CREATE OR REPLACE FUNCTION sync_order_to_waiting_list()
RETURNS TRIGGER AS $$
DECLARE
  vendor_lat numeric;
  vendor_lng numeric;
  vendor_store_name text;
  vendor_phone_number text;
BEGIN
  -- Get vendor information if vendor_id exists
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT latitude, longitude, store_name, phone 
    INTO vendor_lat, vendor_lng, vendor_store_name, vendor_phone_number
    FROM vendors 
    WHERE id = NEW.vendor_id;
  END IF;

  -- Insert or update driver_waiting_list when order reaches waiting-for-driver, preparing, or accepted status
  IF NEW.status IN ('waiting-for-driver', 'preparing', 'accepted') THEN
    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      vendor_name,
      customer_name,
      customer_phone,
      pickup_address,
      delivery_address,
      city,
      order_type,
      delivery_fee,
      status,
      created_at,
      payment_method,
      preparation_time,
      actual_preparation_time,
      preparation_start,
      preparation_end,
      vendor_geocoded_latitude,
      vendor_geocoded_longitude,
      vendor_approved
    ) VALUES (
      NEW.id,
      NEW.vendor_id,
      vendor_store_name,
      NEW.customer_name,
      NEW.customer_phone,
      NEW.address,
      NEW.address,
      NEW.city,
      NEW.order_type,
      NEW.delivery_fee,
      CASE 
        WHEN NEW.status = 'preparing' THEN 'preparing'
        WHEN NEW.status = 'accepted' THEN 'preparing'
        ELSE 'pending'
      END,
      NEW.created_at,
      NEW.payment_method,
      COALESCE(NEW.actual_preparation_time, NEW.preparation_time, 20),
      NEW.actual_preparation_time,
      COALESCE(NEW.preparation_start, now()),
      COALESCE(
        NEW.preparation_end,
        now() + (COALESCE(NEW.actual_preparation_time, NEW.preparation_time, 20) * interval '1 minute')
      ),
      vendor_lat,
      vendor_lng,
      true
    )
    ON CONFLICT (order_id) 
    DO UPDATE SET
      status = CASE 
        WHEN EXCLUDED.status = 'preparing' THEN 'preparing'
        WHEN EXCLUDED.status = 'accepted' THEN 'preparing'
        ELSE 'pending'
      END,
      preparation_time = COALESCE(EXCLUDED.actual_preparation_time, EXCLUDED.preparation_time, 20),
      actual_preparation_time = EXCLUDED.actual_preparation_time,
      preparation_start = COALESCE(EXCLUDED.preparation_start, driver_waiting_list.preparation_start, now()),
      preparation_end = COALESCE(
        EXCLUDED.preparation_end,
        driver_waiting_list.preparation_start + (COALESCE(EXCLUDED.actual_preparation_time, EXCLUDED.preparation_time, 20) * interval '1 minute')
      ),
      vendor_approved = true,
      updated_at = now();

    RAISE NOTICE 'تمت إضافة/تحديث الطلب في قائمة الانتظار: الطلب %, الحالة %, وقت التحضير الفعلي %', 
      NEW.id, NEW.status, NEW.actual_preparation_time;
  END IF;

  -- Remove from waiting list if status changes to delivered, cancelled, or rejected
  IF NEW.status IN ('delivered', 'cancelled', 'rejected') THEN
    DELETE FROM driver_waiting_list WHERE order_id = NEW.id;
    RAISE NOTICE 'تمت إزالة الطلب من قائمة الانتظار: الطلب %, الحالة %', NEW.id, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update insert_captain_trip function to copy actual_preparation_time
CREATE OR REPLACE FUNCTION insert_captain_trip()
RETURNS TRIGGER AS $$
DECLARE
  vendor_lat numeric;
  vendor_lng numeric;
  vendor_store_name text;
  vendor_phone_number text;
  driver_full_name text;
BEGIN
  -- Get driver name
  SELECT full_name INTO driver_full_name
  FROM users
  WHERE id = NEW.captain_id;

  -- Get vendor information if vendor_id exists
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT latitude, longitude, store_name, phone 
    INTO vendor_lat, vendor_lng, vendor_store_name, vendor_phone_number
    FROM vendors 
    WHERE id = NEW.vendor_id;
  END IF;

  -- Insert into driver_waiting_list
  INSERT INTO driver_waiting_list (
    order_id,
    vendor_id,
    vendor_name,
    customer_name,
    customer_phone,
    pickup_address,
    delivery_address,
    city,
    order_type,
    delivery_fee,
    status,
    created_at,
    payment_method,
    preparation_time,
    actual_preparation_time,
    preparation_start,
    preparation_end,
    vendor_geocoded_latitude,
    vendor_geocoded_longitude,
    vendor_approved
  ) VALUES (
    gen_random_uuid(),
    NEW.vendor_id,
    vendor_store_name,
    NEW.passenger_name,
    NEW.passenger_phone,
    NEW.pickup_address,
    NEW.delivery_address,
    NEW.city,
    'captain_request',
    NEW.price,
    'pending',
    NEW.created_at,
    NEW.payment_method,
    COALESCE(NEW.actual_preparation_time, 0),
    NEW.actual_preparation_time,
    now(),
    now(),
    vendor_lat,
    vendor_lng,
    true
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync existing data: copy actual_preparation_time from orders to driver_waiting_list
UPDATE driver_waiting_list dwl
SET 
  actual_preparation_time = o.actual_preparation_time,
  preparation_time = COALESCE(o.actual_preparation_time, o.preparation_time, dwl.preparation_time)
FROM orders o
WHERE dwl.order_id = o.id
AND o.actual_preparation_time IS NOT NULL
AND dwl.actual_preparation_time IS NULL;
