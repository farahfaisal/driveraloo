/*
  # إضافة حالة 'preparing' إلى قيود جدول driver_waiting_list

  1. المشكلة
    - القيد على عمود status في driver_waiting_list لا يسمح بحالة 'preparing'
    - هذا يمنع الطلبات التي بحالة 'processing' أو 'preparing' من الظهور بشكل صحيح
  
  2. الحل
    - تحديث القيد ليشمل الحالات:
      - 'pending': طلبات جديدة في انتظار قبول البائع
      - 'preparing': طلبات قيد التحضير من قبل البائع
      - 'preparing_pending_vendor': طلبات قبلها الأدمن وتنتظر قبول البائع
      - 'accepted': طلبات جاهزة للتوصيل
      - 'ready': طلبات جاهزة تماماً
      - 'rejected': طلبات مرفوضة
*/

-- حذف القيد القديم
ALTER TABLE driver_waiting_list
DROP CONSTRAINT IF EXISTS driver_waiting_list_status_check;

-- إضافة القيد الجديد الذي يشمل 'preparing'
ALTER TABLE driver_waiting_list
ADD CONSTRAINT driver_waiting_list_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'preparing'::text,
  'preparing_pending_vendor'::text, 
  'accepted'::text, 
  'ready'::text, 
  'rejected'::text
]));

COMMENT ON CONSTRAINT driver_waiting_list_status_check ON driver_waiting_list IS 
'يسمح بالحالات: pending (جديد), preparing (قيد التحضير), preparing_pending_vendor (ينتظر البائع), accepted (مقبول), ready (جاهز), rejected (مرفوض)';
