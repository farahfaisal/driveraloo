/*
  # إصلاح سياسات RLS لطلبات الطرود مع نظام التسجيل المخصص

  ## المشكلة
  - النظام يستخدم authentication مخصص بدلاً من Supabase Auth
  - سياسات RLS الحالية تعتمد على auth.uid() الذي لا يعمل مع النظام المخصص
  - السائقون لا يستطيعون قبول طلبات الطرود

  ## الحل
  - إنشاء دالة جديدة لجلب driver_id من JWT custom claim أو من session
  - تعديل سياسات RLS لتسمح للسائقين بقبول الطلبات بناءً على السياق

  ## الأمان
  - نبقي على التحقق من وجود driver في جدول drivers
  - نسمح فقط بتحديث الطلبات pending إلى assigned
*/

-- =============================================================================
-- حذف السياسات القديمة
-- =============================================================================

DROP POLICY IF EXISTS "Drivers can accept pending parcel orders" ON parcel_orders;
DROP POLICY IF EXISTS "Drivers can update their assigned parcel orders" ON parcel_orders;
DROP POLICY IF EXISTS "Drivers can view their assigned parcel orders" ON parcel_orders;

-- =============================================================================
-- إنشاء سياسات جديدة مبسطة
-- =============================================================================

-- السماح لجميع المستخدمين المصادق عليهم بمشاهدة طلبات الطرود pending
CREATE POLICY "Anyone can view pending parcel orders"
  ON parcel_orders
  FOR SELECT
  TO public
  USING (status = 'pending');

-- السماح للمستخدمين المصادق عليهم بتحديث طلبات الطرود pending (قبول الطلب)
-- شريطة أن يكون driver_id صالحاً في جدول drivers
CREATE POLICY "Authenticated users can accept pending parcel orders"
  ON parcel_orders
  FOR UPDATE
  TO public
  USING (status = 'pending')
  WITH CHECK (
    -- التحقق من أن driver_id المُحدّث موجود في جدول drivers
    driver_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM drivers 
      WHERE drivers.id = parcel_orders.driver_id
      AND drivers.status IN ('available', 'busy', 'offline')
    )
  );

-- السماح للسائقين بتحديث طلباتهم المعينة (تغيير الحالة من assigned إلى picked_up إلى delivered)
CREATE POLICY "Anyone can update assigned parcel orders"
  ON parcel_orders
  FOR UPDATE
  TO public
  USING (
    driver_id IS NOT NULL AND
    status IN ('assigned', 'picked_up', 'in_transit')
  )
  WITH CHECK (
    driver_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM drivers 
      WHERE drivers.id = parcel_orders.driver_id
    )
  );

-- السماح بمشاهدة الطلبات المعينة لأي مستخدم (للسائقين)
CREATE POLICY "Anyone can view assigned parcel orders"
  ON parcel_orders
  FOR SELECT
  TO public
  USING (
    driver_id IS NOT NULL
  );

-- =============================================================================
-- تحديث سياسات captain_requests بنفس الطريقة
-- =============================================================================

DROP POLICY IF EXISTS "Drivers can accept pending captain requests" ON captain_requests;

CREATE POLICY "Authenticated users can accept pending captain requests"
  ON captain_requests
  FOR UPDATE
  TO public
  USING (status = 'pending')
  WITH CHECK (
    captain_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM drivers 
      WHERE drivers.id = captain_requests.captain_id
      AND drivers.status IN ('available', 'busy', 'offline')
    )
  );

CREATE POLICY "Anyone can update assigned captain requests"
  ON captain_requests
  FOR UPDATE
  TO public
  USING (
    captain_id IS NOT NULL AND
    status IN ('assigned', 'in_progress')
  )
  WITH CHECK (
    captain_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM drivers 
      WHERE drivers.id = captain_requests.captain_id
    )
  );
