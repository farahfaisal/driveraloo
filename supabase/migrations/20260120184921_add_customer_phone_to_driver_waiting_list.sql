/*
  # إضافة حقل رقم هاتف العميل إلى قائمة الانتظار

  1. Changes
    - إضافة عمود `customer_phone` إلى جدول `driver_waiting_list`
    - تحديث السجلات الموجودة لملء رقم الهاتف من جدول الطلبات
  
  2. Purpose
    - السماح للسائقين بالاتصال بالعملاء مباشرة
    - تحسين تجربة التوصيل
*/

-- إضافة عمود customer_phone إلى جدول driver_waiting_list
ALTER TABLE driver_waiting_list 
ADD COLUMN IF NOT EXISTS customer_phone text;

-- تحديث السجلات الموجودة بملء رقم الهاتف من جدول orders
UPDATE driver_waiting_list dwl
SET customer_phone = o.customer_phone
FROM orders o
WHERE dwl.order_id = o.id
  AND dwl.customer_phone IS NULL
  AND o.customer_phone IS NOT NULL;