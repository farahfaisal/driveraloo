/*
  # إصلاح قائمة انتظار السائقين - إزالة منطق الانتهاء

  ## المشكلة
  - الطلبات تُحذف تلقائياً بعد 30 دقيقة بسبب expires_at
  - الـ trigger add_to_waiting_list_on_status_change لا يضع expires_at كافياً
  - النتيجة: قائمة الانتظار فارغة دائماً

  ## الحل
  1. إيقاف cleanup_expired_waiting_list trigger
  2. تحديث الـ trigger ليضع expires_at بعيداً جداً (سنة)
  3. إضافة الطلبات المفقودة يدوياً
*/

-- 1. إيقاف trigger الحذف التلقائي
DROP TRIGGER IF EXISTS cleanup_expired_waiting_list_trigger ON driver_waiting_list;

-- 2. تحديث دالة add_to_waiting_list_on_status_change لتضع expires_at بعيداً
CREATE OR REPLACE FUNCTION add_to_waiting_list_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_name TEXT;
  v_vendor_lat NUMERIC;
  v_vendor_lng NUMERIC;
BEGIN
  IF NEW.status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')
  AND (OLD.status IS NULL OR OLD.status NOT IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')) THEN

    SELECT store_name, latitude, longitude
    INTO v_vendor_name, v_vendor_lat, v_vendor_lng
    FROM vendors
    WHERE id = NEW.vendor_id;

    IF NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) THEN
      INSERT INTO driver_waiting_list (
        order_id,
        vendor_id,
        customer_name,
        customer_phone,
        address,
        city,
        product_name,
        quantity,
        price,
        total,
        notes,
        payment_method,
        preparation_time,
        actual_preparation_time,
        preparation_start,
        preparation_end,
        order_number,
        vendor_name,
        items_data,
        geocoded_latitude,
        geocoded_longitude,
        vendor_geocoded_latitude,
        vendor_geocoded_longitude,
        status,
        expires_at
      ) VALUES (
        NEW.id,
        NEW.vendor_id,
        NEW.customer_name,
        NEW.customer_phone,
        NEW.address,
        NEW.city,
        NEW.product_name,
        NEW.quantity,
        NEW.price,
        NEW.total,
        NEW.notes,
        NEW.payment_method,
        NEW.preparation_time,
        NEW.actual_preparation_time,
        NEW.preparation_start,
        NEW.preparation_end,
        NEW.order_number,
        v_vendor_name,
        NEW.items_data,
        NEW.geocoded_latitude,
        NEW.geocoded_longitude,
        v_vendor_lat,
        v_vendor_lng,
        'pending',
        NOW() + INTERVAL '365 days'
      );

      RAISE NOTICE '✅ تمت إضافة الطلب % (%) إلى قائمة السائقين', NEW.order_number, NEW.status;
    ELSE
      -- تحديث expires_at للطلبات الموجودة لضمان عدم حذفها
      UPDATE driver_waiting_list
      SET expires_at = NOW() + INTERVAL '365 days'
      WHERE order_id = NEW.id AND (expires_at IS NULL OR expires_at < NOW() + INTERVAL '1 hour');

      RAISE NOTICE '⚠️ الطلب % موجود بالفعل في القائمة', NEW.order_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. تحديث add_order_to_waiting_list أيضاً لتضع expires_at بعيداً
CREATE OR REPLACE FUNCTION add_order_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_name text;
  v_product_name text;
  v_quantity integer;
  v_price numeric;
  v_items_data jsonb;
  v_existing_id uuid;
BEGIN
  IF NEW.status = 'processing' AND (OLD.status IS NULL OR OLD.status != 'processing') THEN

    SELECT id INTO v_existing_id
    FROM driver_waiting_list
    WHERE order_id = NEW.id;

    IF v_existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT store_name INTO v_vendor_name
    FROM vendors
    WHERE id = NEW.vendor_id;

    IF NEW.items_data IS NOT NULL AND jsonb_array_length(NEW.items_data) > 0 THEN
      v_items_data := NEW.items_data;
      v_product_name := COALESCE(NEW.items_data->0->>'name', NEW.product_name, 'طلب');
      v_quantity := COALESCE((NEW.items_data->0->>'quantity')::integer, NEW.quantity, 1);
      v_price := COALESCE((NEW.items_data->0->>'price')::numeric, NEW.price, NEW.subtotal, 0);
    ELSE
      v_items_data := '[]'::jsonb;
      v_product_name := COALESCE(NEW.product_name, 'طلب');
      v_quantity := COALESCE(NEW.quantity, 1);
      v_price := COALESCE(NEW.price, NEW.subtotal, 0);
    END IF;

    INSERT INTO driver_waiting_list (
      order_id,
      captain_order_id,
      vendor_id,
      status,
      customer_name,
      customer_phone,
      address,
      city,
      total,
      notes,
      product_name,
      quantity,
      price,
      payment_method,
      preparation_time,
      actual_preparation_time,
      order_number,
      vendor_name,
      items_data,
      expires_at
    ) VALUES (
      NEW.id,
      NULL,
      NEW.vendor_id,
      'pending',
      NEW.customer_name,
      NEW.customer_phone,
      NEW.address,
      NULL,
      NEW.total,
      NEW.notes,
      v_product_name,
      v_quantity,
      v_price,
      COALESCE(NEW.payment_method, 'cash'),
      COALESCE(NEW.preparation_time, 15),
      COALESCE(NEW.actual_preparation_time, NEW.preparation_time, 15),
      NEW.order_number,
      v_vendor_name,
      v_items_data,
      NOW() + INTERVAL '365 days'
    );

  END IF;

  RETURN NEW;
END;
$$;

-- 4. إضافة الطلبات المفقودة الحالية يدوياً
INSERT INTO driver_waiting_list (
  order_id, vendor_id, status, customer_name, customer_phone,
  address, city, total, notes, payment_method,
  preparation_time, actual_preparation_time, preparation_start, preparation_end,
  order_number, vendor_name, geocoded_latitude, geocoded_longitude,
  vendor_geocoded_latitude, vendor_geocoded_longitude, expires_at
)
SELECT
  o.id,
  o.vendor_id,
  'pending',
  o.customer_name,
  o.customer_phone,
  o.address,
  o.city,
  o.total,
  o.notes,
  COALESCE(o.payment_method, 'cash'),
  o.preparation_time,
  o.actual_preparation_time,
  o.preparation_start,
  o.preparation_end,
  o.order_number,
  v.store_name,
  o.geocoded_latitude,
  o.geocoded_longitude,
  v.latitude,
  v.longitude,
  NOW() + INTERVAL '365 days'
FROM orders o
LEFT JOIN vendors v ON v.id = o.vendor_id
WHERE o.status IN ('processing', 'accepted', 'preparing')
  AND NOT EXISTS (
    SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id
  );

-- 5. تحديث expires_at للطلبات الموجودة التي انتهت صلاحيتها
UPDATE driver_waiting_list
SET expires_at = NOW() + INTERVAL '365 days'
WHERE expires_at < NOW() OR expires_at IS NULL;
