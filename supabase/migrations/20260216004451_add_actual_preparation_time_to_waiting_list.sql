/*
  # إضافة actual_preparation_time إلى driver_waiting_list

  1. التغييرات
    - إضافة عمود actual_preparation_time إلى driver_waiting_list
    - تحديث التريجرات لنسخ actual_preparation_time من orders
    - تحديث الدالة sync_waiting_list_with_orders لمزامنة actual_preparation_time
  
  2. الهدف
    - السماح للسائقين بمعرفة ما إذا كان البائع قد حدد وقت التحضير فعلياً
    - عرض رسالة "لم يحدد البائع الوقت بعد" عندما actual_preparation_time = NULL
  
  3. السلوك
    - إذا كان actual_preparation_time = NULL، يعني أن البائع لم يقبل الطلب بعد
    - إذا كان actual_preparation_time موجود، يعني أن البائع حدد الوقت ويظهر العداد
*/

-- إضافة عمود actual_preparation_time إلى driver_waiting_list
ALTER TABLE driver_waiting_list
ADD COLUMN IF NOT EXISTS actual_preparation_time INTEGER;

-- تحديث الدالة add_to_waiting_list_on_status_change لنسخ actual_preparation_time
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
  -- إضافة الطلب عند أي من الحالات التالية
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
        NEW.actual_preparation_time,  -- نسخ actual_preparation_time
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

-- تحديث الدالة sync_waiting_list_with_orders لمزامنة actual_preparation_time
CREATE OR REPLACE FUNCTION sync_waiting_list_with_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- تحديث driver_waiting_list عند تحديث orders
  IF TG_OP = 'UPDATE' AND NEW.id IN (SELECT order_id FROM driver_waiting_list WHERE order_id = NEW.id) THEN
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
      updated_at = now()
    WHERE order_id = NEW.id;
    
    RAISE NOTICE '🔄 تم تحديث الطلب % في قائمة السائقين (actual_preparation_time = %)', NEW.order_number, NEW.actual_preparation_time;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN driver_waiting_list.actual_preparation_time IS 
'الوقت الفعلي الذي حدده البائع للتحضير بالدقائق - NULL يعني أن البائع لم يقبل الطلب بعد';

COMMENT ON FUNCTION add_to_waiting_list_on_status_change() IS 
'يضيف الطلبات تلقائياً إلى قائمة انتظار السائقين مع نسخ actual_preparation_time من orders';

COMMENT ON FUNCTION sync_waiting_list_with_orders() IS 
'يزامن driver_waiting_list مع orders عند التحديث - يحافظ على الطلبات ويزامن actual_preparation_time';
