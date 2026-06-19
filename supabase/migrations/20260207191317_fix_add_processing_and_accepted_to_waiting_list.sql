/*
  # إصلاح: إضافة الطلبات في حالة "قيد التحضير" و "مقبول" إلى قائمة الانتظار
  
  1. المشكلة
    - الدالة الحالية تُضيف الطلبات فقط في حالة 'waiting-for-driver'
    - الطلبات في حالة 'processing' (قيد التحضير) و 'accepted' (مقبول) لا تُضاف
    - هذا يمنع السائقين من رؤية الطلبات التي قيد التحضير
  
  2. الحل
    - تعديل الدالة لإضافة الطلبات في الحالات التالية:
      * 'processing': قيد التحضير من البائع
      * 'accepted': تم قبول الطلب من البائع
      * 'waiting-for-driver': في انتظار السائق
    - الاحتفاظ بنفس المنطق للتحقق من عدم التكرار
  
  3. السلوك الجديد
    - عندما يتم تحديث حالة الطلب إلى أي من الحالات المذكورة
    - يتم إضافة الطلب تلقائياً إلى driver_waiting_list
    - السائقين يمكنهم رؤية الطلبات فوراً عند بدء التحضير
*/

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
  -- إضافة الطلب عند أي من الحالات التالية: processing, accepted, waiting-for-driver
  IF NEW.status IN ('processing', 'accepted', 'waiting-for-driver') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('processing', 'accepted', 'waiting-for-driver')) THEN
    
    -- الحصول على بيانات المتجر
    SELECT store_name, latitude, longitude
    INTO v_vendor_name, v_vendor_lat, v_vendor_lng
    FROM vendors
    WHERE id = NEW.vendor_id;
    
    -- إضافة الطلب إلى قائمة انتظار السائقين (فقط إذا لم يكن موجوداً)
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
      
      RAISE NOTICE '✅ تم إضافة الطلب % (حالة: %) إلى قائمة السائقين مع وقت تحضير % دقيقة', 
        NEW.id, NEW.status, COALESCE(NEW.preparation_time, 30);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة الطلبات الموجودة حالياً إلى قائمة الانتظار
-- (الطلبات التي في حالة processing, accepted, waiting-for-driver ولكن ليست في driver_waiting_list)
DO $$
DECLARE
  v_order RECORD;
  v_vendor_name TEXT;
  v_vendor_lat NUMERIC;
  v_vendor_lng NUMERIC;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'بدء إضافة الطلبات الموجودة إلى قائمة الانتظار...';
  
  FOR v_order IN 
    SELECT o.*
    FROM orders o
    LEFT JOIN driver_waiting_list dwl ON dwl.order_id = o.id
    WHERE o.status IN ('processing', 'accepted', 'waiting-for-driver')
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
    RAISE NOTICE '✅ تمت إضافة الطلب % (%) إلى القائمة', v_order.order_number, v_order.status;
  END LOOP;
  
  RAISE NOTICE 'تم إضافة % طلب إلى قائمة الانتظار', v_count;
END;
$$;

-- إضافة تعليق توضيحي
COMMENT ON FUNCTION add_to_waiting_list_on_status_change() IS 
'يضيف الطلبات تلقائياً إلى قائمة انتظار السائقين عندما تصبح في حالة processing أو accepted أو waiting-for-driver';
