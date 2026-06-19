/*
  # إصلاح عدم إعادة تعيين preparation_start عند التحديث
  
  ## المشكلة
  - عندما يحدث البائع preparation_time، يتم إعادة تعيين preparation_start إلى NOW()
  - هذا يسبب اختلاف في الوقت المتبقي بين تطبيق البائع والسائق
  - مثال: البائع حدد 60 دقيقة منذ 3 دقائق، لكن عند التحديث يصبح preparation_start الآن
  
  ## الحل
  1. لا نعيد تعيين preparation_start إذا كان موجوداً بالفعل
  2. فقط نحدث preparation_end بناءً على preparation_start الأصلي
  3. هذا يضمن أن العداد يعد من الوقت الأصلي للقبول
  
  ## النتيجة
  - الوقت المتبقي متناسق بين جميع التطبيقات
  - لا يتم إعادة تعيين العداد عند تحديث الوقت
*/

-- تحديث الدالة لعدم إعادة تعيين preparation_start
CREATE OR REPLACE FUNCTION auto_sync_preparation_time_to_actual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إذا تم تحديث preparation_time ولم يتم تحديث actual_preparation_time
  IF NEW.preparation_time IS NOT NULL AND 
     NEW.preparation_time != COALESCE(OLD.preparation_time, 0) AND
     (NEW.actual_preparation_time IS NULL OR NEW.actual_preparation_time = OLD.actual_preparation_time) THEN
    
    -- نسخ preparation_time إلى actual_preparation_time
    NEW.actual_preparation_time := NEW.preparation_time;
    
    -- CRITICAL: لا نعيد تعيين preparation_start إذا كان موجوداً بالفعل
    -- فقط نستخدم القيمة الحالية أو القديمة
    IF NEW.preparation_start IS NULL AND OLD.preparation_start IS NULL THEN
      NEW.preparation_start := NOW();
      RAISE NOTICE '✅ تعيين preparation_start لأول مرة للطلب %', NEW.order_number;
    ELSIF NEW.preparation_start IS NULL THEN
      -- استخدم القيمة القديمة إذا لم يتم تحديد قيمة جديدة
      NEW.preparation_start := OLD.preparation_start;
      RAISE NOTICE '🔄 استخدام preparation_start القديم للطلب %', NEW.order_number;
    END IF;
    
    -- حساب preparation_end بناءً على preparation_start (سواء كان جديد أو قديم)
    NEW.preparation_end := NEW.preparation_start + (NEW.preparation_time * INTERVAL '1 minute');
    
    RAISE NOTICE '⏰ مزامنة: الطلب %, preparation_time = %, preparation_start = %, preparation_end = %',
      NEW.order_number, NEW.preparation_time, NEW.preparation_start, NEW.preparation_end;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إضافة تعليقات
COMMENT ON FUNCTION auto_sync_preparation_time_to_actual() IS 
'ينسخ preparation_time تلقائياً إلى actual_preparation_time ويحافظ على preparation_start الأصلي';
