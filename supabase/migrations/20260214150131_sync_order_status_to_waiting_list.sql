/*
  # مزامنة حالة الطلبات بين orders و driver_waiting_list
  
  1. المشكلة
    - عند إضافة طلب بحالة 'preparing' من جدول orders إلى driver_waiting_list، يتم تعيين الحالة إلى 'pending'
    - هذا يسبب عدم ظهور الطلبات قيد التحضير في التطبيق
  
  2. الحل
    - تحديث دالة add_to_waiting_list_on_status_change لتستخدم الحالة المناسبة من جدول orders
    - إنشاء trigger جديد لمزامنة التحديثات على حالة الطلبات
    - تحديث الطلبات الموجودة في قائمة الانتظار
*/

-- 1. تحديث دالة إضافة الطلبات لقائمة الانتظار
CREATE OR REPLACE FUNCTION add_to_waiting_list_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_name TEXT;
  v_vendor_lat NUMERIC;
  v_vendor_lng NUMERIC;
  v_waiting_list_status TEXT;
BEGIN
  -- إضافة الطلب عند أي من الحالات التالية
  IF NEW.status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')) THEN
    
    -- تحديد الحالة المناسبة لقائمة الانتظار
    IF NEW.status = 'preparing' THEN
      v_waiting_list_status := 'preparing';
    ELSE
      v_waiting_list_status := 'pending';
    END IF;
    
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
        NEW.preparation_time,
        NEW.preparation_time, -- استخدام preparation_time كـ actual_preparation_time
        NEW.preparation_start,
        NEW.preparation_end,
        NEW.order_number,
        v_vendor_name,
        NEW.items_data,
        NEW.geocoded_latitude,
        NEW.geocoded_longitude,
        v_vendor_lat,
        v_vendor_lng,
        v_waiting_list_status
      );
      
      RAISE NOTICE '✅ تمت إضافة الطلب % بحالة % إلى قائمة السائقين', NEW.order_number, v_waiting_list_status;
    ELSE
      RAISE NOTICE '⚠️ الطلب % موجود بالفعل في القائمة', NEW.order_number;
    END IF;
  
  -- تحديث حالة الطلب في قائمة الانتظار عند تغيير الحالة
  ELSIF NEW.status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver') 
        AND OLD.status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')
        AND NEW.status != OLD.status THEN
    
    -- تحديد الحالة المناسبة لقائمة الانتظار
    IF NEW.status = 'preparing' THEN
      v_waiting_list_status := 'preparing';
    ELSE
      v_waiting_list_status := 'pending';
    END IF;
    
    -- تحديث حالة الطلب في قائمة الانتظار
    UPDATE driver_waiting_list
    SET 
      status = v_waiting_list_status,
      preparation_time = NEW.preparation_time,
      actual_preparation_time = NEW.preparation_time,
      preparation_start = NEW.preparation_start,
      preparation_end = NEW.preparation_end,
      updated_at = NOW()
    WHERE order_id = NEW.id;
    
    RAISE NOTICE '✅ تم تحديث حالة الطلب % إلى % في قائمة السائقين', NEW.order_number, v_waiting_list_status;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. إعادة إنشاء التريجر
DROP TRIGGER IF EXISTS add_to_waiting_list_trigger ON orders;
CREATE TRIGGER add_to_waiting_list_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_status_change();

-- 3. تحديث الطلبات الموجودة في قائمة الانتظار
DO $$
DECLARE
  v_order RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔄 بدء تحديث حالات الطلبات في قائمة الانتظار...';
  
  -- تحديث الطلبات بحالة preparing
  FOR v_order IN 
    SELECT o.id, o.order_number, o.status, o.preparation_time, o.preparation_start, o.preparation_end
    FROM orders o
    INNER JOIN driver_waiting_list dwl ON dwl.order_id = o.id
    WHERE o.status = 'preparing' AND dwl.status != 'preparing'
  LOOP
    UPDATE driver_waiting_list
    SET 
      status = 'preparing',
      preparation_time = v_order.preparation_time,
      actual_preparation_time = v_order.preparation_time,
      preparation_start = v_order.preparation_start,
      preparation_end = v_order.preparation_end,
      updated_at = NOW()
    WHERE order_id = v_order.id;
    
    v_count := v_count + 1;
    RAISE NOTICE '✅ تم تحديث الطلب % إلى حالة preparing', v_order.order_number;
  END LOOP;
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ تم تحديث % طلب في قائمة الانتظار', v_count;
  ELSE
    RAISE NOTICE 'ℹ️ لا توجد طلبات تحتاج تحديث';
  END IF;
END;
$$;

-- 4. تعليق توضيحي
COMMENT ON FUNCTION add_to_waiting_list_on_status_change() IS 
'يضيف ويحدث الطلبات في قائمة انتظار السائقين مع مزامنة الحالة من جدول orders';
