/*
  # إصلاح نهائي لقائمة انتظار السائقين

  ## المشكلة
  - وجود triggers متعددة ومتعارضة على جدول orders
  - بعض الدوال تحاول إدراج أعمدة غير موجودة (vendor_approved, pickup_address, delivery_address, order_type)
  - هذا يسبب خطأ صامتاً ويمنع إضافة الطلبات للقائمة

  ## الحل
  - حذف جميع triggers الإضافة المتعارضة
  - إبقاء trigger واحد فقط وصحيح
  - الطلبات تبقى في القائمة حتى تتغير حالتها إلى delivered/cancelled/rejected
*/

-- 1. حذف جميع triggers الإضافة المتعارضة من orders
DROP TRIGGER IF EXISTS add_processing_orders_to_waiting_list ON orders;
DROP TRIGGER IF EXISTS add_to_waiting_list_trigger ON orders;
DROP TRIGGER IF EXISTS on_admin_accept_order_trigger ON orders;
DROP TRIGGER IF EXISTS on_vendor_accept_order_trigger ON orders;
DROP TRIGGER IF EXISTS sync_waiting_list_with_orders ON orders;
DROP TRIGGER IF EXISTS sync_preparation_time_trigger ON orders;

-- 2. إنشاء دالة واحدة نظيفة تدير قائمة الانتظار
CREATE OR REPLACE FUNCTION manage_driver_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_name TEXT;
  v_vendor_lat NUMERIC;
  v_vendor_lng NUMERIC;
BEGIN
  -- حذف من القائمة عند إنهاء الطلب
  IF NEW.status IN ('delivered', 'cancelled', 'rejected') THEN
    DELETE FROM driver_waiting_list WHERE order_id = NEW.id;
    RETURN NEW;
  END IF;

  -- إضافة للقائمة عند وصول الطلب لحالة نشطة
  IF NEW.status IN ('processing', 'accepted', 'preparing', 'waiting-for-driver')
  AND (OLD.status IS NULL OR OLD.status NOT IN ('processing', 'accepted', 'preparing', 'waiting-for-driver')) THEN

    SELECT store_name, latitude, longitude
    INTO v_vendor_name, v_vendor_lat, v_vendor_lng
    FROM vendors WHERE id = NEW.vendor_id;

    INSERT INTO driver_waiting_list (
      order_id,
      vendor_id,
      customer_name,
      customer_phone,
      address,
      city,
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
      NEW.total,
      NEW.notes,
      COALESCE(NEW.payment_method, 'cash'),
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
    )
    ON CONFLICT (order_id) DO NOTHING;

  END IF;

  -- تحديث بيانات الطلب في القائمة عند تغيير أي بيانات
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) THEN
    UPDATE driver_waiting_list
    SET
      preparation_time = NEW.preparation_time,
      actual_preparation_time = NEW.actual_preparation_time,
      preparation_start = NEW.preparation_start,
      preparation_end = NEW.preparation_end,
      customer_name = NEW.customer_name,
      customer_phone = NEW.customer_phone,
      address = NEW.address,
      city = NEW.city,
      total = NEW.total,
      notes = NEW.notes,
      updated_at = NOW()
    WHERE order_id = NEW.id
      AND status NOT IN ('accepted', 'delivered', 'cancelled');
  END IF;

  RETURN NEW;
END;
$$;

-- 3. ربط الـ trigger الجديد
DROP TRIGGER IF EXISTS manage_driver_waiting_list_trigger ON orders;
CREATE TRIGGER manage_driver_waiting_list_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION manage_driver_waiting_list();

-- 4. التأكد من وجود unique constraint على order_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'driver_waiting_list_order_id_key'
      AND conrelid = 'driver_waiting_list'::regclass
  ) THEN
    ALTER TABLE driver_waiting_list ADD CONSTRAINT driver_waiting_list_order_id_key UNIQUE (order_id);
  END IF;
END $$;

-- 5. إضافة الطلبات النشطة الحالية التي لم تُضف بعد
INSERT INTO driver_waiting_list (
  order_id, vendor_id, status, customer_name, customer_phone,
  address, city, total, notes, payment_method,
  preparation_time, actual_preparation_time, preparation_start, preparation_end,
  order_number, vendor_name, geocoded_latitude, geocoded_longitude,
  vendor_geocoded_latitude, vendor_geocoded_longitude, expires_at
)
SELECT
  o.id, o.vendor_id, 'pending', o.customer_name, o.customer_phone,
  o.address, o.city, o.total, o.notes, COALESCE(o.payment_method, 'cash'),
  o.preparation_time, o.actual_preparation_time, o.preparation_start, o.preparation_end,
  o.order_number, v.store_name, o.geocoded_latitude, o.geocoded_longitude,
  v.latitude, v.longitude,
  NOW() + INTERVAL '365 days'
FROM orders o
LEFT JOIN vendors v ON v.id = o.vendor_id
WHERE o.status IN ('processing', 'accepted', 'preparing', 'waiting-for-driver')
  AND NOT EXISTS (SELECT 1 FROM driver_waiting_list dwl WHERE dwl.order_id = o.id);

-- 6. تحديث expires_at لأي طلبات موجودة منتهية الصلاحية
UPDATE driver_waiting_list
SET expires_at = NOW() + INTERVAL '365 days'
WHERE expires_at < NOW() + INTERVAL '1 day' OR expires_at IS NULL;
