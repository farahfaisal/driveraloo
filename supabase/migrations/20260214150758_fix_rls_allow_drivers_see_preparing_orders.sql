/*
  # إصلاح: السماح للسائقين برؤية الطلبات قيد التحضير
  
  1. المشكلة
    - سياسة RLS الحالية تسمح للسائقين فقط برؤية الطلبات بحالة 'pending'
    - الطلبات قيد التحضير (preparing) لا تظهر للسائقين
  
  2. الحل
    - تحديث السياسة لتشمل الطلبات بحالة 'preparing' أيضاً
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Drivers can view orders in waiting list" ON driver_waiting_list;

-- إنشاء السياسة الجديدة
CREATE POLICY "Drivers can view orders in waiting list"
  ON driver_waiting_list
  FOR SELECT
  TO authenticated
  USING (
    status IN ('pending', 'preparing') 
    OR driver_id = auth.uid()
  );

COMMENT ON POLICY "Drivers can view orders in waiting list" ON driver_waiting_list IS 
'يسمح للسائقين برؤية الطلبات بحالة pending أو preparing، أو الطلبات المعينة لهم';
