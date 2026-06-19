/*
  # إجبار تحديد وقت التحضير عند قبول الطلب

  1. التغييرات
    - إضافة قيد (constraint) يتطلب وجود preparation_time، preparation_start، preparation_end
      عندما تكون حالة الطلب 'accepted' أو 'processing' أو 'preparing'
    - هذا يضمن أن البائع لا يمكنه قبول الطلب بدون تحديد وقت التحضير

  2. الأمان
    - يحمي من قبول الطلبات بدون وقت تحضير
    - يضمن أن السائقين يحصلون على معلومات كاملة
*/

-- إضافة قيد للتأكد من وجود وقت التحضير عند قبول الطلب
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_preparation_time_required;

ALTER TABLE orders
ADD CONSTRAINT orders_preparation_time_required
CHECK (
  -- إذا كانت الحالة accepted أو processing أو preparing، يجب أن يكون لها وقت تحضير
  (status NOT IN ('accepted', 'processing', 'preparing')) OR
  (
    preparation_time IS NOT NULL AND 
    preparation_time > 0 AND
    preparation_start IS NOT NULL AND 
    preparation_end IS NOT NULL
  )
);

-- إضافة تعليق على القيد
COMMENT ON CONSTRAINT orders_preparation_time_required ON orders IS 
'يجب تحديد وقت التحضير (preparation_time و preparation_start و preparation_end) عند قبول الطلب أو تغيير حالته إلى accepted أو processing أو preparing';
