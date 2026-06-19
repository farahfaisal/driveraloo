/*
  # تحديث صلاحيات البائعين - إخفاء الطلبات غير الموافق عليها
  
  1. التغييرات
    - تحديث جميع RLS policies للبائعين والمستخدمين
    - إضافة شرط admin_approved = true لجميع policies
    - ضمان عدم ظهور الطلبات للبائعين قبل موافقة الأدمن
  
  2. السلوك
    - البائعون لا يرون إلا الطلبات الموافق عليها من الأدمن
    - يحمي من الطلبات الوهمية أو المعلقة
*/

-- حذف Policy القديم للمستخدمين العامين
DROP POLICY IF EXISTS "public_can_view_waiting_list" ON driver_waiting_list;

-- إنشاء Policy جديد مع فلترة admin_approved
CREATE POLICY "public_can_view_waiting_list"
ON driver_waiting_list
FOR SELECT
TO public
USING (
  status = 'pending' 
  AND admin_approved = true    -- ✅ فلترة جديدة
  AND (vendor_approved = true OR vendor_approved IS NULL)
);

-- تحديث policy البائعين للتحديث
DROP POLICY IF EXISTS "vendors_can_update_their_orders" ON driver_waiting_list;

CREATE POLICY "vendors_can_update_their_orders"
ON driver_waiting_list
FOR UPDATE
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND admin_approved = true    -- ✅ فلترة جديدة - البائع لا يستطيع تعديل طلبات غير موافق عليها
);

-- تحديث policy البائعين للإدراج (إذا كانوا يضيفون طلبات)
DROP POLICY IF EXISTS "vendors_can_insert_orders" ON driver_waiting_list;

CREATE POLICY "vendors_can_insert_orders"
ON driver_waiting_list
FOR INSERT
TO authenticated
WITH CHECK (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
);

-- إضافة policy جديد للبائعين لعرض طلباتهم فقط
DROP POLICY IF EXISTS "vendors_can_view_their_orders" ON driver_waiting_list;

CREATE POLICY "vendors_can_view_their_orders"
ON driver_waiting_list
FOR SELECT
TO authenticated
USING (
  vendor_id IN (
    SELECT id FROM vendors WHERE user_id = auth.uid()
  )
  AND admin_approved = true    -- ✅ فلترة جديدة
);

-- إضافة تعليق توضيحي
COMMENT ON TABLE driver_waiting_list IS 'قائمة انتظار الطلبات للسائقين - تتطلب admin_approved = true للظهور';
