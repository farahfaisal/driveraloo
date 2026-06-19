/*
  # إضافة حالة completed إلى قيد جدول order_status_history
  
  1. المشكلة
    - القيد الحالي لجدول order_status_history لا يحتوي على حالة 'completed'
    - عند محاولة إضافة سجل تاريخي بحالة completed، يفشل بسبب انتهاك القيد
    - الخطأ: "new row for relation "order_status_history" violates check constraint "order_status_history_status_check""
  
  2. الحل
    - إزالة القيد القديم
    - إضافة قيد جديد يحتوي على جميع الحالات بما فيها 'completed'
  
  3. الحالات المسموح بها
    - pending: قيد الانتظار
    - vendor_pending: في انتظار موافقة البائع
    - pending_review: قيد المراجعة
    - accepted: تم القبول
    - rejected: مرفوض
    - processing: قيد المعالجة
    - ready: جاهز
    - waiting-for-driver: في انتظار سائق
    - delivered-to-driver: تم التسليم للسائق
    - picked_up: تم الاستلام
    - delivering: قيد التوصيل
    - shipping: قيد الشحن
    - delivered: تم التوصيل
    - completed: مكتمل
    - cancelled: ملغي
*/

-- إزالة القيد القديم
ALTER TABLE order_status_history 
DROP CONSTRAINT IF EXISTS order_status_history_status_check;

-- إضافة القيد الجديد مع جميع الحالات المطلوبة
ALTER TABLE order_status_history 
ADD CONSTRAINT order_status_history_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'vendor_pending'::text,
  'pending_review'::text,
  'accepted'::text,
  'rejected'::text,
  'processing'::text,
  'ready'::text,
  'waiting-for-driver'::text,
  'waiting_for_driver'::text,
  'delivered-to-driver'::text,
  'picked_up'::text,
  'delivering'::text,
  'shipping'::text,
  'on_the_way'::text,
  'delivered'::text,
  'completed'::text,
  'cancelled'::text,
  'start_preparing'::text,
  'vendor_accepted_waiting'::text
]));

-- إضافة تعليق توضيحي
COMMENT ON CONSTRAINT order_status_history_status_check ON order_status_history IS 
'قيد للتحقق من صحة حالة الطلب في التاريخ - يسمح بجميع الحالات المطلوبة بما فيها completed';
