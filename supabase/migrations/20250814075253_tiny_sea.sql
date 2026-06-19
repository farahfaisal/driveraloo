/*
  # إضافة المستخدم المفقود في جدول custom_users

  1. إضافة المستخدم
    - إضافة المستخدم بـ UUID: 4c2a36e3-78ec-4a78-9e54-386c14388be8
    - تعيين الدور كـ 'driver'
    - إضافة بيانات أساسية للمستخدم

  2. التحقق من البيانات
    - التأكد من عدم وجود المستخدم مسبقاً
    - ربط المستخدم بجدول drivers إذا كان موجوداً

  3. الأمان
    - استخدام ON CONFLICT لتجنب الأخطاء
    - تحديث البيانات إذا كان المستخدم موجود
*/

-- إضافة المستخدم المفقود في جدول custom_users
INSERT INTO custom_users (
  id, 
  username, 
  name, 
  email, 
  role, 
  status,
  created_at,
  updated_at
)
VALUES (
  '4c2a36e3-78ec-4a78-9e54-386c14388be8',
  'driver_system',
  'سائق النظام',
  'driver@system.local',
  'driver',
  'active',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = now();

-- التحقق من وجود سائق مرتبط بهذا المستخدم وتحديث user_id إذا لزم الأمر
DO $$
BEGIN
  -- البحث عن سائق بدون user_id أو بـ user_id خاطئ
  UPDATE drivers 
  SET user_id = '4c2a36e3-78ec-4a78-9e54-386c14388be8',
      updated_at = now()
  WHERE id = '4c2a36e3-78ec-4a78-9e54-386c14388be8' 
    AND (user_id IS NULL OR user_id != '4c2a36e3-78ec-4a78-9e54-386c14388be8');
    
  -- إذا لم يوجد سائق بهذا الـ ID، قم بإنشاء واحد
  INSERT INTO drivers (
    id,
    user_id,
    name,
    email,
    status,
    rating,
    commission_rate,
    created_at,
    updated_at,
    password
  )
  SELECT 
    '4c2a36e3-78ec-4a78-9e54-386c14388be8',
    '4c2a36e3-78ec-4a78-9e54-386c14388be8',
    'سائق النظام',
    'driver@system.local',
    'available',
    5.00,
    15.00,
    now(),
    now(),
    'system_driver_password'
  WHERE NOT EXISTS (
    SELECT 1 FROM drivers WHERE id = '4c2a36e3-78ec-4a78-9e54-386c14388be8'
  );
END $$;