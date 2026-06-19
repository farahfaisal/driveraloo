/*
  # إعادة إنشاء نظام العداد التلقائي عند تحديد وقت التحضير
  
  ## المشكلة
  - عندما يحدد البائع actual_preparation_time، لا يبدأ العداد تلقائياً
  - الـ trigger والـ function المطلوبة غير موجودة
  
  ## الحل
  1. إنشاء دالة set_actual_preparation_time_on_acceptance
     - تراقب تغييرات actual_preparation_time
     - عند تحديد actual_preparation_time، تحسب preparation_start و preparation_end تلقائياً
  
  2. إنشاء trigger على جدول orders
     - يتم تفعيله عند UPDATE
     - يستدعي الدالة لحساب الأوقات
  
  ## النتيجة
  - عندما يحدد البائع actual_preparation_time، يبدأ العداد فوراً
  - preparation_start = الوقت الحالي
  - preparation_end = preparation_start + actual_preparation_time دقيقة
*/

-- إنشاء الدالة لحساب أوقات التحضير تلقائياً
CREATE OR REPLACE FUNCTION set_actual_preparation_time_on_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- عندما يتم تحديث actual_preparation_time
  IF NEW.actual_preparation_time IS NOT NULL AND 
     (OLD.actual_preparation_time IS NULL OR NEW.actual_preparation_time != OLD.actual_preparation_time) THEN
    
    -- حساب preparation_start (إذا لم يكن محدداً)
    IF NEW.preparation_start IS NULL THEN
      NEW.preparation_start := NOW();
      RAISE NOTICE '✅ تم تعيين preparation_start تلقائياً للطلب %', NEW.order_number;
    END IF;
    
    -- حساب preparation_end بناءً على actual_preparation_time
    NEW.preparation_end := NEW.preparation_start + (NEW.actual_preparation_time * INTERVAL '1 minute');
    
    RAISE NOTICE '⏰ تم بدء عداد التحضير للطلب %: البداية = %, النهاية = %, المدة = % دقيقة', 
      NEW.order_number, NEW.preparation_start, NEW.preparation_end, NEW.actual_preparation_time;
  END IF;
  
  -- إذا تم مسح actual_preparation_time، امسح الأوقات
  IF NEW.actual_preparation_time IS NULL AND OLD.actual_preparation_time IS NOT NULL THEN
    NEW.preparation_start := NULL;
    NEW.preparation_end := NULL;
    RAISE NOTICE '🔄 تم إعادة تعيين أوقات التحضير للطلب %', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS auto_set_preparation_times_on_update ON orders;

-- إنشاء trigger على جدول orders
CREATE TRIGGER auto_set_preparation_times_on_update
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_actual_preparation_time_on_acceptance();

-- إضافة تعليق توضيحي
COMMENT ON FUNCTION set_actual_preparation_time_on_acceptance() IS 
'يحسب preparation_start و preparation_end تلقائياً عندما يحدد البائع actual_preparation_time';

COMMENT ON TRIGGER auto_set_preparation_times_on_update ON orders IS
'يبدأ عداد التحضير تلقائياً عندما يحدد البائع وقت التحضير';
