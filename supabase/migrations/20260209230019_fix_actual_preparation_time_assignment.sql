/*
  # إصلاح خطأ في إسناد actual_preparation_time

  1. المشكلة
    - في دالة set_actual_preparation_time_on_acceptance() استخدام خاطئ لـ `=` بدلاً من `:=`
    - في PostgreSQL PL/pgSQL، يجب استخدام `:=` للإسناد
    - `=` يستخدم للمقارنة فقط
    - هذا يمنع actual_preparation_time من التحديث بشكل صحيح
  
  2. الحل
    - تصحيح السطر 33 ليستخدم `:=` بدلاً من `=`
    - هذا سيضمن أن actual_preparation_time يتم تعيينه بشكل صحيح
*/

-- إعادة إنشاء دالة set_actual_preparation_time_on_acceptance مع الإسناد الصحيح
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
    
    -- تصحيح: استخدام := للإسناد بدلاً من =
    NEW.actual_preparation_time := NEW.preparation_time;
    
    -- حساب preparation_start و preparation_end
    IF NEW.preparation_start IS NULL THEN
      NEW.preparation_start := NOW();
    END IF;
    
    NEW.preparation_end := NEW.preparation_start + (NEW.actual_preparation_time * INTERVAL '1 minute');
    
    RAISE NOTICE '✅ تم تعيين actual_preparation_time = % للطلب %', NEW.actual_preparation_time, NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_actual_preparation_time_on_acceptance() IS 
'ينسخ preparation_time إلى actual_preparation_time تلقائياً عند قبول الطلب من البائع - مع إصلاح خطأ الإسناد';
