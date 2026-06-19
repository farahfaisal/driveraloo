/*
  # إضافة مزامنة فورية لوقت التحضير إلى قائمة انتظار السائقين
  
  ## المشكلة
  - عندما يحدث البائع actual_preparation_time، يحتاج السائق لرؤية التحديث فوراً
  - trigger الحالي sync_order_to_waiting_list يعمل فقط عند تغيير الحالة
  - نحتاج trigger إضافي يعمل عند تحديث actual_preparation_time فقط
  
  ## الحل
  1. إنشاء دالة sync_preparation_time_instantly
     - تراقب تغييرات actual_preparation_time
     - تحدث driver_waiting_list فوراً
  
  2. إنشاء trigger يعمل على UPDATE فقط
     - يتفعل عند تغيير actual_preparation_time أو preparation_start أو preparation_end
  
  ## النتيجة
  - عندما يحدد البائع الوقت، يرى السائق التحديث فوراً
  - شاشة السائق تتحدث بدون الحاجة لإعادة تحميل
*/

-- إنشاء دالة للمزامنة الفورية
CREATE OR REPLACE FUNCTION sync_preparation_time_instantly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- فقط إذا كان الطلب موجود في driver_waiting_list
  -- وتم تحديث actual_preparation_time أو preparation_start أو preparation_end
  IF EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) THEN
    
    -- تحديث فوري لـ driver_waiting_list
    UPDATE driver_waiting_list
    SET 
      actual_preparation_time = NEW.actual_preparation_time,
      preparation_time = COALESCE(NEW.actual_preparation_time, NEW.preparation_time, preparation_time),
      preparation_start = COALESCE(NEW.preparation_start, preparation_start),
      preparation_end = COALESCE(NEW.preparation_end, preparation_end),
      updated_at = NOW()
    WHERE order_id = NEW.id;
    
    RAISE NOTICE '⚡ مزامنة فورية: الطلب %, وقت التحضير الفعلي = %, البداية = %, النهاية = %',
      NEW.order_number, NEW.actual_preparation_time, NEW.preparation_start, NEW.preparation_end;
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS instant_preparation_time_sync ON orders;

-- إنشاء trigger للمزامنة الفورية
CREATE TRIGGER instant_preparation_time_sync
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (
    -- فقط عند تغيير actual_preparation_time أو preparation_start أو preparation_end
    (NEW.actual_preparation_time IS DISTINCT FROM OLD.actual_preparation_time) OR
    (NEW.preparation_start IS DISTINCT FROM OLD.preparation_start) OR
    (NEW.preparation_end IS DISTINCT FROM OLD.preparation_end)
  )
  EXECUTE FUNCTION sync_preparation_time_instantly();

-- إضافة تعليقات توضيحية
COMMENT ON FUNCTION sync_preparation_time_instantly() IS 
'يزامن وقت التحضير فوراً من orders إلى driver_waiting_list عند تحديث البائع للوقت';

COMMENT ON TRIGGER instant_preparation_time_sync ON orders IS
'يضمن أن السائق يرى تحديثات وقت التحضير فوراً بدون تأخير';
