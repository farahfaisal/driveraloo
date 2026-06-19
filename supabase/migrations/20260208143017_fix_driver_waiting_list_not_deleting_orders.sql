/*
  # إصلاح مشكلة حذف الطلبات من driver_waiting_list

  1. المشكلة
    - عندما نقوم بتحديث preparation_time في orders، تختفي الطلبات من driver_waiting_list
    - trigger معين يحذف الطلبات عند التحديث
  
  2. الحل
    - تحديث trigger ليحافظ على الطلبات في driver_waiting_list
    - تحديث driver_waiting_list عند تحديث orders بدلاً من حذفها
  
  3. السلوك الجديد
    - عند تحديث preparation_time في orders، يتم تحديث driver_waiting_list تلقائياً
    - الطلبات لا تختفي من driver_waiting_list
*/

-- حذف الـ trigger القديم
DROP TRIGGER IF EXISTS sync_waiting_list_with_orders ON orders;

-- إنشاء دالة جديدة لمزامنة driver_waiting_list مع orders
CREATE OR REPLACE FUNCTION sync_waiting_list_with_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- تحديث driver_waiting_list عند تحديث orders
  IF TG_OP = 'UPDATE' AND NEW.id IN (SELECT order_id FROM driver_waiting_list WHERE order_id = NEW.id) THEN
    UPDATE driver_waiting_list
    SET
      preparation_time = NEW.preparation_time,
      preparation_start = NEW.preparation_start,
      preparation_end = NEW.preparation_end,
      customer_name = NEW.customer_name,
      customer_phone = NEW.customer_phone,
      address = NEW.address,
      city = NEW.city,
      total = NEW.total,
      notes = NEW.notes,
      updated_at = now()
    WHERE order_id = NEW.id;
    
    RAISE NOTICE '🔄 تم تحديث الطلب % في قائمة السائقين', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger جديد
CREATE TRIGGER sync_waiting_list_with_orders
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_waiting_list_with_orders();

COMMENT ON FUNCTION sync_waiting_list_with_orders() IS 
'يزامن driver_waiting_list مع orders عند التحديث - يحافظ على الطلبات ولا يحذفها';
