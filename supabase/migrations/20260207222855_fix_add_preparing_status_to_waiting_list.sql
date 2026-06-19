/*
  # إصلاح: إضافة حالة preparing إلى قائمة الانتظار
  
  1. المشكلة
    - التريجر لا يضيف الطلبات في حالة 'preparing' إلى قائمة السائقين
    - السائقون لا يرون الطلبات قيد التحضير
  
  2. الحل
    - تحديث التريجر ليشمل حالة 'preparing'
    - إضافة جميع الطلبات الموجودة بحالة 'preparing' إلى القائمة
*/

-- حذف التريجر القديم
DROP TRIGGER IF EXISTS add_to_waiting_list_trigger ON orders;

-- تحديث الدالة لتشمل حالة preparing
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
  -- إضافة الطلب عند أي من الحالات التالية (بما في ذلك preparing)
  IF NEW.status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')) THEN
    
    -- الحصول على بيانات المتجر
    SELECT store_name, latitude, longitude
    INTO v_vendor_name, v_vendor_lat, v_vendor_lng
    FROM vendors
    WHERE id = NEW.vendor_id;
    
    -- إضافة الطلب إلى قائمة انتظار السائقين
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
        preparation_start,
        preparation_end,
        order_number,
        vendor_name,
        items_data,
        geocoded_latitude,
        geocoded_longitude,
        vendor_geocoded_latitude,
        vendor_geocoded_longitude,
        status
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
        COALESCE(NEW.preparation_time, 30),
        NEW.preparation_start,
        NEW.preparation_end,
        NEW.order_number,
        v_vendor_name,
        NEW.items_data,
        NEW.geocoded_latitude,
        NEW.geocoded_longitude,
        v_vendor_lat,
        v_vendor_lng,
        'pending'
      );
      
      RAISE NOTICE '✅ تمت إضافة الطلب % (%) إلى قائمة السائقين', NEW.order_number, NEW.status;
    ELSE
      RAISE NOTICE '⚠️ الطلب % موجود بالفعل في القائمة', NEW.order_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء التريجر
CREATE TRIGGER add_to_waiting_list_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_status_change();

-- إضافة جميع الطلبات بحالة preparing الموجودة حالياً
DO $$
DECLARE
  v_order RECORD;
  v_vendor_name TEXT;
  v_vendor_lat NUMERIC;
  v_vendor_lng NUMERIC;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 بدء إضافة الطلبات بحالة preparing إلى قائمة الانتظار...';
  
  FOR v_order IN 
    SELECT o.*
    FROM orders o
    LEFT JOIN driver_waiting_list dwl ON dwl.order_id = o.id
    WHERE o.status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')
      AND dwl.id IS NULL
  LOOP
    -- الحصول على بيانات المتجر
    SELECT store_name, latitude, longitude
    INTO v_vendor_name, v_vendor_lat, v_vendor_lng
    FROM vendors
    WHERE id = v_order.vendor_id;
    
    -- إضافة الطلب
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
      preparation_start,
      preparation_end,
      order_number,
      vendor_name,
      items_data,
      geocoded_latitude,
      geocoded_longitude,
      vendor_geocoded_latitude,
      vendor_geocoded_longitude,
      status
    ) VALUES (
      v_order.id,
      v_order.vendor_id,
      v_order.customer_name,
      v_order.customer_phone,
      v_order.address,
      v_order.city,
      v_order.product_name,
      v_order.quantity,
      v_order.price,
      v_order.total,
      v_order.notes,
      v_order.payment_method,
      COALESCE(v_order.preparation_time, 30),
      v_order.preparation_start,
      v_order.preparation_end,
      v_order.order_number,
      v_vendor_name,
      v_order.items_data,
      v_order.geocoded_latitude,
      v_order.geocoded_longitude,
      v_vendor_lat,
      v_vendor_lng,
      'pending'
    );
    
    v_count := v_count + 1;
    RAISE NOTICE '✅ تمت إضافة الطلب %', v_order.order_number;
  END LOOP;
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ تم إضافة % طلب إلى قائمة الانتظار', v_count;
  ELSE
    RAISE NOTICE 'ℹ️ لا توجد طلبات جديدة لإضافتها';
  END IF;
END;
$$;

-- تعليق توضيحي
COMMENT ON FUNCTION add_to_waiting_list_on_status_change() IS 
'يضيف الطلبات تلقائياً إلى قائمة انتظار السائقين عندما تكون في حالة processing أو preparing أو accepted أو waiting-for-driver';
