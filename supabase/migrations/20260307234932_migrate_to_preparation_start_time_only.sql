/*
  # الانتقال إلى استخدام preparation_start_time فقط
  
  ## المشكلة
  - النظام يستخدم preparation_start و preparation_start_time معاً
  - preparation_start يُعيّن عند الإنشاء
  - preparation_start_time يُعيّن عند القبول
  - هذا يسبب فرق في الوقت (3 دقائق في المثال)
  
  ## الحل
  1. نسخ قيم preparation_start_time إلى preparation_start إذا كانت أحدث
  2. حذف preparation_start و preparation_end
  3. إعادة تسمية preparation_start_time ليصبح preparation_start (للتوافق)
  4. إنشاء triggers جديدة بسيطة
  
  ## البنية النهائية
  - preparation_time: الوقت المتوقع (integer)
  - preparation_start: وقت بدء التحضير (timestamptz) - يُسجل عند القبول
  - actual_preparation_time: الوقت الفعلي (integer)
*/

-- 1. نسخ القيم من preparation_start_time إلى preparation_start
UPDATE orders
SET preparation_start = preparation_start_time
WHERE preparation_start_time IS NOT NULL
  AND (preparation_start IS NULL OR preparation_start_time > preparation_start);

-- 2. حذف preparation_end و preparation_start_time
ALTER TABLE orders 
  DROP COLUMN IF EXISTS preparation_end,
  DROP COLUMN IF EXISTS preparation_start_time;

-- 3. حذف الأعمدة من driver_waiting_list
ALTER TABLE driver_waiting_list
  DROP COLUMN IF EXISTS preparation_end,
  DROP COLUMN IF EXISTS preparation_start;

-- 4. إنشاء دالة بسيطة لتعيين preparation_start عند القبول
CREATE OR REPLACE FUNCTION set_preparation_start_on_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- عند تغيير الحالة إلى accepted، نسجل وقت البدء
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    IF NEW.preparation_start IS NULL THEN
      NEW.preparation_start := NOW();
      RAISE NOTICE '⏰ تسجيل وقت بدء التحضير للطلب %: %', NEW.order_number, NEW.preparation_start;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_preparation_start_on_acceptance
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_preparation_start_on_acceptance();

-- 5. إنشاء دالة لمزامنة preparation_time إلى actual_preparation_time
CREATE OR REPLACE FUNCTION sync_preparation_time_to_actual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- عند تحديث preparation_time، ننسخه إلى actual_preparation_time
  IF NEW.preparation_time IS NOT NULL AND 
     NEW.preparation_time != COALESCE(OLD.preparation_time, 0) THEN
    
    NEW.actual_preparation_time := NEW.preparation_time;
    
    RAISE NOTICE '⏰ مزامنة: الطلب %, preparation_time = %, actual_preparation_time = %',
      NEW.order_number, NEW.preparation_time, NEW.actual_preparation_time;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_preparation_time_to_actual
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_preparation_time_to_actual();

-- 6. تحديث دالة sync لـ driver_waiting_list
CREATE OR REPLACE FUNCTION sync_waiting_list_on_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE driver_waiting_list
    SET
      status = CASE 
        WHEN NEW.status = 'processing' THEN 'preparing'
        ELSE NEW.status
      END,
      preparation_time = NEW.preparation_time,
      actual_preparation_time = NEW.actual_preparation_time,
      updated_at = NOW()
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_waiting_list_on_order_update ON orders;
CREATE TRIGGER sync_waiting_list_on_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_waiting_list_on_order_update();

-- 7. إضافة تعليقات توضيحية
COMMENT ON COLUMN orders.preparation_time IS 'مدة التحضير المتوقعة بالدقائق';
COMMENT ON COLUMN orders.preparation_start IS 'وقت بدء التحضير الفعلي - يتم تسجيله تلقائياً عند تغيير الحالة إلى accepted';
COMMENT ON COLUMN orders.actual_preparation_time IS 'الوقت الفعلي للتحضير بالدقائق - يتم تسجيله عندما يعدل البائع الوقت يدوياً';

COMMENT ON FUNCTION set_preparation_start_on_acceptance() IS 'يسجل وقت بدء التحضير تلقائياً عند قبول الطلب';
COMMENT ON FUNCTION sync_preparation_time_to_actual() IS 'ينسخ preparation_time إلى actual_preparation_time عند التحديث';
COMMENT ON FUNCTION sync_waiting_list_on_order_update() IS 'يحدث البيانات في driver_waiting_list عند تحديث الطلب';
