/*
  # تحديث سياسة RLS للسائقين لرؤية الطلبات قيد التحضير

  1. المشكلة
    - السياسة الحالية تسمح للسائقين فقط برؤية الطلبات بحالة 'pending'
    - الطلبات بحالة 'preparing' لا تظهر للسائقين
  
  2. الحل
    - تحديث سياسة "Drivers can view orders in waiting list"
    - السماح للسائقين برؤية الطلبات بحالة 'pending' أو 'preparing'
    - هذا يسمح للسائقين برؤية الطلبات قيد التحضير وقبولها
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Drivers can view orders in waiting list" ON driver_waiting_list;

-- إنشاء السياسة الجديدة
CREATE POLICY "Drivers can view orders in waiting list"
ON driver_waiting_list
FOR SELECT
TO authenticated
USING (
  -- السماح للسائقين برؤية:
  -- 1. الطلبات الجديدة (pending)
  -- 2. الطلبات قيد التحضير (preparing)
  -- 3. الطلبات المعينة لهم
  (status IN ('pending', 'preparing')) OR (driver_id = auth.uid())
);

COMMENT ON POLICY "Drivers can view orders in waiting list" ON driver_waiting_list IS 
'يسمح للسائقين برؤية الطلبات الجديدة (pending) والطلبات قيد التحضير (preparing) والطلبات المعينة لهم';
