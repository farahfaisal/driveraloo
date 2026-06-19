/*
  # إضافة الطلبات تلقائياً عند حالة "قيد التحضير"
  
  1. التغييرات
    - تعديل دالة auto_add_to_waiting_list 
    - إضافة الطلبات تلقائياً عندما تكون في حالة "processing" بغض النظر عن إعدادات المعالجة التلقائية
    - الاحتفاظ بالمنطق القديم للحالات الأخرى
  
  2. السلوك الجديد
    - الطلبات في حالة "processing" → تُضاف تلقائياً دائماً
    - الطلبات في حالات أخرى → تتبع إعدادات المعالجة التلقائية
*/

CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_auto_processing_status TEXT;
  v_exists BOOLEAN;
  v_should_add BOOLEAN := false;
BEGIN
  -- إذا كانت الحالة "processing" نضيف دائماً
  IF NEW.status = 'processing' THEN
    v_should_add := true;
  ELSE
    -- للحالات الأخرى، نتحقق من إعدادات المعالجة التلقائية
    SELECT settings INTO v_settings
    FROM app_settings
    LIMIT 1;
    
    v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
    v_auto_processing_status := COALESCE(v_settings->'orders'->>'autoProcessingStatus', 'processing');
    
    IF v_auto_processing AND NEW.status IN ('waiting-for-driver', 'preparing') THEN
      v_should_add := true;
    END IF;
  END IF;
  
  -- إضافة الطلب إذا كان يجب ذلك
  IF v_should_add THEN
    IF TG_TABLE_NAME = 'orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          order_id, 
          order_number,
          vendor_id, 
          customer_name,
          customer_phone,
          address,
          city,
          total, 
          status, 
          created_at
        ) VALUES (
          NEW.id,
          NEW.order_number,
          NEW.vendor_id, 
          NEW.customer_name,
          NEW.customer_phone,
          NEW.address,
          NEW.city,
          NEW.total, 
          'pending', 
          now()
        );
      END IF;
      
    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE captain_order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          captain_order_id,
          order_number,
          vendor_id, 
          total, 
          status, 
          created_at
        ) VALUES (
          NEW.id,
          NEW.order_number,
          NULL, 
          NEW.delivery_fee, 
          'pending', 
          now()
        );
      END IF;
      
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          parcel_order_id,
          order_number,
          vendor_id, 
          total, 
          status, 
          created_at,
          geocoded_latitude, 
          geocoded_longitude
        ) VALUES (
          NEW.id,
          NEW.order_number,
          NULL, 
          NEW.delivery_fee, 
          'pending', 
          now(),
          NEW.sender_latitude, 
          NEW.sender_longitude
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
