/*
  # مزامنة تلقائية من preparation_time إلى actual_preparation_time
  
  ## المشكلة
  - البائع يحدث preparation_time بدلاً من actual_preparation_time
  - مكون PreparationTimer يتحقق فقط من actual_preparation_time
  - النتيجة: العداد لا يظهر للسائق
  
  ## الحل
  1. إنشاء trigger يعمل عند تحديث preparation_time
  2. نسخ القيمة تلقائياً إلى actual_preparation_time
  3. حساب preparation_start و preparation_end تلقائياً
  
  ## النتيجة
  - أي تحديث لـ preparation_time يتم نسخه تلقائياً
  - العداد يظهر دائماً للسائق
  - عدم حاجة البائع لمعرفة الفرق بين الحقلين
*/

-- إنشاء دالة للمزامنة التلقائية
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
    
    -- حساب preparation_start إذا لم يكن محدداً
    IF NEW.preparation_start IS NULL THEN
      NEW.preparation_start := NOW();
    END IF;
    
    -- حساب preparation_end
    NEW.preparation_end := NEW.preparation_start + (NEW.preparation_time * INTERVAL '1 minute');
    
    RAISE NOTICE '🔄 مزامنة تلقائية: الطلب %, preparation_time = % → actual_preparation_time = %',
      NEW.order_number, NEW.preparation_time, NEW.actual_preparation_time;
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS auto_sync_prep_time_trigger ON orders;

-- إنشاء trigger
CREATE TRIGGER auto_sync_prep_time_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.preparation_time IS DISTINCT FROM OLD.preparation_time)
  EXECUTE FUNCTION auto_sync_preparation_time_to_actual();

-- تحديث الطلبات الموجودة التي لديها preparation_time فقط
UPDATE orders
SET actual_preparation_time = preparation_time
WHERE preparation_time IS NOT NULL 
  AND actual_preparation_time IS NULL
  AND status IN ('accepted', 'preparing', 'waiting-for-driver', 'processing');

-- إضافة تعليقات
COMMENT ON FUNCTION auto_sync_preparation_time_to_actual() IS 
'ينسخ preparation_time تلقائياً إلى actual_preparation_time ليعمل العداد بشكل صحيح';

COMMENT ON TRIGGER auto_sync_prep_time_trigger ON orders IS
'يضمن أن أي تحديث لـ preparation_time يتم نسخه إلى actual_preparation_time';
