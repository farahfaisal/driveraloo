/*
  # تفعيل RLS على جدول captain_requests
  
  1. التغييرات
    - تفعيل Row Level Security على جدول captain_requests
    - التأكد من وجود سياسات الوصول الصحيحة
    
  2. الأمان
    - السماح لجميع المستخدمين برؤية طلبات الكابتن المتاحة
    - السماح للكابتنات بقبول الطلبات وتحديث حالتها
    - السماح للعملاء بإنشاء طلبات جديدة
*/

-- تفعيل RLS على جدول captain_requests
ALTER TABLE captain_requests ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Anyone can view captain requests" ON captain_requests;
DROP POLICY IF EXISTS "Anyone can create captain requests" ON captain_requests;
DROP POLICY IF EXISTS "Authenticated users can manage captain requests" ON captain_requests;
DROP POLICY IF EXISTS "Users can update own pending captain requests" ON captain_requests;

-- سياسة: جميع المستخدمين يمكنهم رؤية جميع طلبات الكابتن
CREATE POLICY "Everyone can view all captain requests"
  ON captain_requests
  FOR SELECT
  TO public
  USING (true);

-- سياسة: السماح بإنشاء طلبات جديدة من أي شخص (عملاء)
CREATE POLICY "Anyone can create captain requests"
  ON captain_requests
  FOR INSERT
  TO public
  WITH CHECK (true);

-- سياسة: الكابتنات يمكنهم قبول الطلبات وتحديث حالتها
CREATE POLICY "Captains can accept and update requests"
  ON captain_requests
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

-- سياسة: العملاء يمكنهم تحديث طلباتهم المعلقة فقط
CREATE POLICY "Users can update own pending requests"
  ON captain_requests
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND customer_phone IS NOT NULL
  )
  WITH CHECK (
    status = 'pending'
    AND customer_phone IS NOT NULL
  );

-- سياسة: السماح للنظام بإدارة جميع الطلبات
CREATE POLICY "Service role can manage all captain requests"
  ON captain_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
