/*
  # السماح بوقت تحضير NULL قبل قبول البائع
  
  1. المشكلة
    - القيد orders_preparation_time_required يجبر جميع الطلبات في حالة processing أو preparing على أن يكون لها وقت تحضير
    - هذا يمنع إظهار رسالة "لم يستلم البائع الطلب بعد" للسائقين
    - البائع قد لم يقبل الطلب بعد ولم يحدد وقت التحضير
  
  2. الحل
    - حذف القيد القديم
    - السماح بـ NULL لوقت التحضير
    - عندما يقبل البائع ويحدد الوقت، يتم ملء هذه الحقول
  
  3. سلوك النظام الجديد
    - الطلب يُنشأ بدون وقت تحضير
    - يظهر للسائقين "لم يستلم البائع الطلب بعد"
    - عندما يقبل البائع، يحدد وقت التحضير ويظهر العداد
*/

-- حذف القيد القديم
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_preparation_time_required;

-- تحديث التريجر ليدعم NULL في وقت التحضير
DROP TRIGGER IF EXISTS add_to_waiting_list_trigger ON orders;

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
        NEW.preparation_time,  -- لا نستخدم COALESCE - نسمح بـ NULL
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

-- تحديث الطلبات الموجودة لإزالة وقت التحضير (للطلبات التي لم يقبلها البائع بعد)
UPDATE orders
SET 
  preparation_time = NULL,
  preparation_start = NULL,
  preparation_end = NULL
WHERE status IN ('processing', 'preparing', 'accepted', 'waiting-for-driver')
  AND preparation_time IS NOT NULL;

COMMENT ON FUNCTION add_to_waiting_list_on_status_change() IS 
'يضيف الطلبات تلقائياً إلى قائمة انتظار السائقين عندما تكون في حالة processing أو preparing أو accepted أو waiting-for-driver';
