/*
  # تحديث دالة الإضافة التلقائية لقائمة الانتظار
  
  1. التغييرات
    - تحديث دالة auto_add_to_waiting_list لدعم حالات إضافية
    - إضافة دعم لحالة 'waiting-for-driver'
    - إضافة دعم لحالة 'preparing' 
    - تحسين منطق الإضافة التلقائية
  
  2. الهدف
    - ضمان إضافة الطلبات تلقائيًا إلى driver_waiting_list عند الحاجة
    - دعم جميع حالات الطلبات المختلفة
*/

-- حذف الدالة القديمة وإنشاء نسخة محدثة
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
BEGIN
  -- الحصول على إعدادات المعالجة التلقائية
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  v_auto_processing_status := COALESCE(v_settings->'orders'->>'autoProcessingStatus', 'processing');
  
  -- إذا كانت المعالجة التلقائية مفعلة
  IF v_auto_processing THEN
    -- التحقق من أن الطلب في إحدى الحالات المناسبة
    IF NEW.status IN ('processing', 'waiting-for-driver', 'preparing') THEN
      IF TG_TABLE_NAME = 'orders' THEN
        -- التحقق من عدم وجود الطلب في القائمة
        SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) INTO v_exists;
        
        IF NOT v_exists THEN
          INSERT INTO driver_waiting_list (
            order_id, 
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
            vendor_id, 
            total, 
            status, 
            created_at
          ) VALUES (
            NEW.id, 
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
            vendor_id, 
            total, 
            status, 
            created_at,
            geocoded_latitude, 
            geocoded_longitude
          ) VALUES (
            NEW.id, 
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
  END IF;
  
  RETURN NEW;
END;
$$;
