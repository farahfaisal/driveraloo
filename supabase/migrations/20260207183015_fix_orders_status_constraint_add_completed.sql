/*
  # إضافة حالة completed إلى قيد جدول orders
  
  1. المشكلة
    - القيد الحالي لا يحتوي على حالة 'completed'
    - عند محاولة تحديث الطلب إلى completed، يفشل بسبب انتهاك القيد
  
  2. الحل
    - إزالة القيد القديم
    - إضافة قيد جديد يحتوي على جميع الحالات بما فيها 'completed'
  
  3. الحالات المسموح بها
    - pending: قيد الانتظار
    - vendor_pending: في انتظار موافقة البائع
    - pending_review: قيد المراجعة
    - accepted: تم القبول
    - processing: قيد المعالجة
    - ready: جاهز للتوصيل
    - waiting-for-driver: في انتظار سائق
    - picked_up: تم استلامه من قبل السائق
    - delivering: قيد التوصيل
    - shipping: قيد الشحن
    - delivered: تم التوصيل
    - completed: مكتمل
    - rejected: مرفوض
    - cancelled: ملغي
*/

-- إزالة القيد القديم
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- إضافة القيد الجديد مع جميع الحالات المطلوبة
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'vendor_pending'::text,
  'pending_review'::text,
  'accepted'::text,
  'processing'::text,
  'ready'::text,
  'waiting-for-driver'::text,
  'waiting_for_driver'::text,
  'picked_up'::text,
  'delivering'::text,
  'shipping'::text,
  'on_the_way'::text,
  'delivered'::text,
  'completed'::text,
  'rejected'::text,
  'cancelled'::text,
  'start_preparing'::text,
  'vendor_accepted_waiting'::text
]));

-- إضافة تعليق توضيحي
COMMENT ON CONSTRAINT orders_status_check ON orders IS 
'قيد للتحقق من صحة حالة الطلب - يسمح بجميع الحالات المطلوبة بما فيها completed';
