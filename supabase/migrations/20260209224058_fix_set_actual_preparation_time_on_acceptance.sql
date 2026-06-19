/*
  # إصلاح تعيين actual_preparation_time عند قبول الطلب

  1. المشكلة
    - عندما يقبل البائع الطلب مع preparation_time، لا يتم تعيين actual_preparation_time
    - يجب نسخ preparation_time إلى actual_preparation_time عند القبول
  
  2. الحل
    - تريجر جديد يعمل عند تحديث orders
    - عندما يتغير status إلى 'accepted' وactual_preparation_time = NULL
    - ينسخ preparation_time إلى actual_preparation_time تلقائياً
  
  3. السلوك
    - عند قبول الطلب: actual_preparation_time = preparation_time
    - يزامن driver_waiting_list تلقائياً عبر التريجر الموجود
*/

-- دالة لتعيين actual_preparation_time عند قبول الطلب
CREATE OR REPLACE FUNCTION set_actual_preparation_time_on_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- عندما يتغير status إلى accepted/preparing/waiting-for-driver
  -- وactual_preparation_time = NULL
  -- ينسخ preparation_time إلى actual_preparation_time
  IF NEW.status IN ('accepted', 'preparing', 'waiting-for-driver') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'preparing', 'waiting-for-driver'))
     AND NEW.actual_preparation_time IS NULL
     AND NEW.preparation_time IS NOT NULL THEN
    
    NEW.actual_preparation_time = NEW.preparation_time;
    
    RAISE NOTICE '✅ تم تعيين actual_preparation_time = % للطلب %', NEW.preparation_time, NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- تريجر يعمل قبل تحديث orders
DROP TRIGGER IF EXISTS trigger_set_actual_preparation_time ON orders;
CREATE TRIGGER trigger_set_actual_preparation_time
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_actual_preparation_time_on_acceptance();

-- إصلاح الطلبات الموجودة التي لديها preparation_time لكن ليس لديها actual_preparation_time
UPDATE orders
SET actual_preparation_time = preparation_time
WHERE status IN ('accepted', 'preparing', 'waiting-for-driver')
  AND actual_preparation_time IS NULL
  AND preparation_time IS NOT NULL;

-- مزامنة driver_waiting_list
UPDATE driver_waiting_list dwl
SET actual_preparation_time = o.actual_preparation_time
FROM orders o
WHERE dwl.order_id = o.id
  AND dwl.actual_preparation_time IS NULL
  AND o.actual_preparation_time IS NOT NULL;

COMMENT ON FUNCTION set_actual_preparation_time_on_acceptance() IS 
'ينسخ preparation_time إلى actual_preparation_time تلقائياً عند قبول الطلب من البائع';

COMMENT ON TRIGGER trigger_set_actual_preparation_time ON orders IS 
'يعمل قبل تحديث orders لتعيين actual_preparation_time = preparation_time عند القبول';