/*
  # تحديث دالة مزامنة وقت التحضير لاستخدام actual_preparation_time

  1. التغييرات
    - تحديث دالة sync_preparation_time_to_waiting_list لاستخدام actual_preparation_time
    - استخدام actual_preparation_time مع fallback إلى preparation_time
  
  2. السلوك الجديد
    - عندما يتم تحديث actual_preparation_time، يتم تحديث driver_waiting_list
    - إذا لم يكن actual_preparation_time محدداً، استخدم preparation_time
*/

CREATE OR REPLACE FUNCTION sync_preparation_time_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إذا تم تحديث actual_preparation_time
  IF NEW.actual_preparation_time IS NOT NULL AND 
     (OLD.actual_preparation_time IS NULL OR NEW.actual_preparation_time != OLD.actual_preparation_time) THEN
    
    -- تحديث السجل في driver_waiting_list إذا كان موجوداً
    UPDATE driver_waiting_list
    SET preparation_time = NEW.actual_preparation_time
    WHERE order_id = NEW.id;
    
    RAISE NOTICE 'تم تحديث وقت التحضير الفعلي في قائمة الانتظار: الطلب %, الوقت %', NEW.id, NEW.actual_preparation_time;
  END IF;
  
  -- إذا تم تحديث الحالة إلى waiting-for-driver
  IF NEW.status = 'waiting-for-driver' AND OLD.status != 'waiting-for-driver' THEN
    
    -- تحديث preparation_time في driver_waiting_list
    UPDATE driver_waiting_list
    SET 
      preparation_time = COALESCE(NEW.actual_preparation_time, NEW.preparation_time),
      status = 'pending'
    WHERE order_id = NEW.id;
    
    RAISE NOTICE 'تم تحديث الطلب لحالة waiting-for-driver: الطلب %, الوقت %', NEW.id, COALESCE(NEW.actual_preparation_time, NEW.preparation_time);
  END IF;
  
  RETURN NEW;
END;
$$;
