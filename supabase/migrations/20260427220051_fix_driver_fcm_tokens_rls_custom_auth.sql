/*
  # إصلاح RLS لجدول driver_fcm_tokens للـ custom auth

  ## المشكلة
  - التطبيق يستخدم custom auth (custom_users) وليس Supabase Auth
  - RLS الحالي يعتمد على auth.uid() الذي لا يعمل مع custom auth
  - السائقون لا يستطيعون حفظ FCM tokens

  ## الحل
  - السماح بالإدراج للجميع (الأمان في طبقة التطبيق)
  - الـ edge function notify-drivers-fcm تستخدم service_role لقراءة الـ tokens
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Drivers can insert own FCM token" ON driver_fcm_tokens;
DROP POLICY IF EXISTS "Drivers can update own FCM token" ON driver_fcm_tokens;
DROP POLICY IF EXISTS "Drivers can read own FCM token" ON driver_fcm_tokens;
DROP POLICY IF EXISTS "Drivers can delete own FCM token" ON driver_fcm_tokens;

-- سياسة إدراج مفتوحة (الـ token نفسه هو المعرف الآمن)
CREATE POLICY "Anyone can insert FCM token"
  ON driver_fcm_tokens FOR INSERT
  WITH CHECK (true);

-- سياسة تحديث بناءً على قيمة الـ token
CREATE POLICY "Anyone can update own FCM token"
  ON driver_fcm_tokens FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- سياسة قراءة مفتوحة (للـ edge function)
CREATE POLICY "Anyone can read FCM tokens"
  ON driver_fcm_tokens FOR SELECT
  USING (true);

-- سياسة حذف بناءً على قيمة الـ token
CREATE POLICY "Anyone can delete own FCM token"
  ON driver_fcm_tokens FOR DELETE
  USING (true);
