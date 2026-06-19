/*
  # حذف Trigger الخاطئ لنسخ preparation_time إلى actual_preparation_time
  
  ## المشكلة
  - الكود الحالي ينسخ preparation_time إلى actual_preparation_time عند قبول الطلب
  - هذا خطأ لأن:
    - preparation_time = الوقت المخصص الذي حدده البائع (مثلاً 44 دقيقة)
    - actual_preparation_time = الوقت الفعلي الذي استغرقه التحضير (يُحسب بعد الانتهاء)
  
  ## الحل
  - حذف الـ trigger والـ function الخاطئة
  - السماح لـ preparation_time بالعمل كما هو
  - السائق سيرى الوقت من preparation_time مباشرة
*/

-- Drop the incorrect trigger
DROP TRIGGER IF EXISTS trigger_set_actual_preparation_time ON orders;

-- Drop the incorrect function
DROP FUNCTION IF EXISTS set_actual_preparation_time_on_acceptance();

-- Clear incorrect actual_preparation_time values that were copied from preparation_time
-- Only clear where actual_preparation_time equals preparation_time 
-- (these are the ones that were incorrectly copied)
UPDATE orders
SET actual_preparation_time = NULL
WHERE actual_preparation_time = preparation_time
AND status NOT IN ('delivered', 'cancelled');

-- Clear from driver_waiting_list as well
UPDATE driver_waiting_list dwl
SET actual_preparation_time = NULL
FROM orders o
WHERE dwl.order_id = o.id
AND dwl.actual_preparation_time = o.preparation_time
AND o.status NOT IN ('delivered', 'cancelled');
