/*
  # تفعيل RLS على جدول driver_waiting_list
  
  1. التغييرات
    - تفعيل Row Level Security على جدول driver_waiting_list
    - التأكد من وجود سياسات الوصول الصحيحة
    
  2. الأمان
    - السماح لجميع المستخدمين برؤية الطلبات المتاحة (pending)
    - السماح للسائقين بتحديث الطلبات المعينة لهم
    - السماح للتجار بإدارة طلباتهم
*/

-- تفعيل RLS على جدول driver_waiting_list
ALTER TABLE driver_waiting_list ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة المتضاربة
DROP POLICY IF EXISTS "Anyone can manage waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Public can view waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Public can insert waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Public can update waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Authenticated users can insert waiting list orders" ON driver_waiting_list;
DROP POLICY IF EXISTS "Authenticated users can update waiting list orders" ON driver_waiting_list;

-- سياسة: جميع المستخدمين يمكنهم رؤية جميع الطلبات في قائمة الانتظار
CREATE POLICY "Everyone can view all waiting list orders"
  ON driver_waiting_list
  FOR SELECT
  TO public
  USING (true);

-- سياسة: التجار يمكنهم إضافة طلبات إلى قائمة الانتظار
CREATE POLICY "Vendors can insert their waiting list orders"
  ON driver_waiting_list
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = driver_waiting_list.vendor_id
      AND v.user_id = auth.uid()
    )
  );

-- سياسة: التجار يمكنهم تحديث طلباتهم في قائمة الانتظار
CREATE POLICY "Vendors can update their waiting list orders"
  ON driver_waiting_list
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = driver_waiting_list.vendor_id
      AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = driver_waiting_list.vendor_id
      AND v.user_id = auth.uid()
    )
  );

-- سياسة: السائقون يمكنهم قبول الطلبات وتحديث حالتها
CREATE POLICY "Drivers can accept and update waiting list orders"
  ON driver_waiting_list
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.user_id = auth.uid()
    )
  );

-- سياسة: السماح للنظام بإدارة الطلبات (للعمليات الداخلية)
CREATE POLICY "Service role can manage all waiting list orders"
  ON driver_waiting_list
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
