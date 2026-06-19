/*
  # استخدام actual_preparation_time بدلاً من preparation_time

  1. التغييرات
    - تعديل دالة set_preparation_times لتستخدم actual_preparation_time
    - actual_preparation_time يحتوي على الوقت الذي يحدده البائع فعلياً
    - preparation_time كان له default value وكان يسبب مشاكل
  
  2. السلوك الجديد
    - عندما يحدد البائع وقت التحضير، يتم حفظه في actual_preparation_time
    - يتم حساب preparation_start و preparation_end بناءً على actual_preparation_time
    - إذا لم يحدد البائع الوقت، يكون actual_preparation_time = NULL
*/

-- تحديث دالة set_preparation_times لتستخدم actual_preparation_time
CREATE OR REPLACE FUNCTION set_preparation_times()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set preparation times when status is appropriate AND actual_preparation_time is explicitly set
  IF (NEW.status = 'pending' OR NEW.status = 'processing' OR NEW.status = 'confirmed') 
     AND NEW.actual_preparation_time IS NOT NULL THEN
    
    -- Set preparation_start to current time if not set
    IF NEW.preparation_start IS NULL THEN
      NEW.preparation_start := now();
    END IF;
    
    -- Calculate preparation_end based on actual_preparation_time
    NEW.preparation_end := NEW.preparation_start + (NEW.actual_preparation_time * interval '1 minute');
  END IF;
  
  -- Copy vendor coordinates to vendor_geocoded fields if available
  IF TG_TABLE_NAME = 'driver_waiting_list' AND NEW.vendor_id IS NOT NULL THEN
    -- Try to get vendor coordinates
    DECLARE
      vendor_lat numeric;
      vendor_lng numeric;
    BEGIN
      SELECT latitude, longitude INTO vendor_lat, vendor_lng
      FROM vendors 
      WHERE id = NEW.vendor_id;
      
      IF vendor_lat IS NOT NULL AND vendor_lng IS NOT NULL THEN
        NEW.vendor_geocoded_latitude := vendor_lat;
        NEW.vendor_geocoded_longitude := vendor_lng;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Silently fail and continue
        NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN orders.actual_preparation_time IS 
'وقت التحضير الفعلي بالدقائق الذي يحدده البائع عند قبول الطلب';

COMMENT ON COLUMN orders.preparation_time IS 
'حقل قديم - استخدم actual_preparation_time بدلاً منه';
