/*
  # إضافة حالة picked_up للطلبات

  1. التغييرات
    - إضافة حالة `picked_up` إلى check constraint في جدول `orders`
    - إضافة حالة `picked_up` إلى check constraint في جدول `order_status_history`
  
  2. الغرض
    - تُستخدم هذه الحالة عندما يقبل السائق الطلب من قائمة الانتظار وينتقل إلى "رحلاتي"
    - تمثل المرحلة بين قبول الطلب وبدء التوصيل الفعلي
  
  3. ملاحظات
    - الحالة الجديدة: `picked_up` = تم استلام الطلب من قبل السائق
*/

-- إزالة القيد القديم من جدول orders
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- إضافة القيد الجديد مع الحالة picked_up
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'pending_review'::text, 
  'accepted'::text, 
  'processing'::text, 
  'ready'::text,
  'waiting-for-driver'::text,
  'picked_up'::text,
  'delivering'::text,
  'shipping'::text,
  'delivered'::text,
  'completed'::text, 
  'rejected'::text, 
  'cancelled'::text
]));

-- إزالة القيد القديم من جدول order_status_history
ALTER TABLE order_status_history 
DROP CONSTRAINT IF EXISTS order_status_history_status_check;

-- إضافة القيد الجديد مع الحالة picked_up
ALTER TABLE order_status_history 
ADD CONSTRAINT order_status_history_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'pending_review'::text, 
  'accepted'::text, 
  'rejected'::text, 
  'processing'::text, 
  'waiting-for-driver'::text,
  'delivered-to-driver'::text,
  'picked_up'::text,
  'delivering'::text,
  'shipping'::text,
  'delivered'::text,
  'completed'::text, 
  'cancelled'::text
]));
