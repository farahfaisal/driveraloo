/*
  # إصلاح وقت التحضير للطلبات الموجودة

  1. المشكلة
    - بعض الطلبات الموجودة لديها preparation_time لا يتطابق مع الفرق بين start و end
    - مثال: preparation_time = 30 لكن الفرق الفعلي = 20 دقيقة
    - هذا يسبب ارتباك للسائقين

  2. الحل
    - إعادة حساب preparation_end بناءً على preparation_time و preparation_start
    - تصحيح جميع الطلبات النشطة

  3. التأثير
    - الوقت المعروض سيكون دقيقاً ومطابقاً لما أدخله البائع
*/

-- تصحيح الطلبات الموجودة في جدول orders
UPDATE orders
SET 
  preparation_end = preparation_start + (preparation_time * INTERVAL '1 minute'),
  updated_at = NOW()
WHERE 
  status IN ('accepted', 'processing', 'preparing', 'picked_up', 'waiting-for-driver')
  AND preparation_time IS NOT NULL
  AND preparation_start IS NOT NULL
  AND preparation_end IS NOT NULL
  -- فقط الطلبات التي لديها فرق زمني خاطئ
  AND ABS(EXTRACT(EPOCH FROM (preparation_end - preparation_start)) / 60 - preparation_time) > 1;

-- تصحيح الطلبات الموجودة في جدول driver_waiting_list
UPDATE driver_waiting_list
SET 
  preparation_end = preparation_start + (preparation_time * INTERVAL '1 minute'),
  updated_at = NOW()
WHERE 
  preparation_time IS NOT NULL
  AND preparation_start IS NOT NULL
  AND preparation_end IS NOT NULL
  -- فقط الطلبات التي لديها فرق زمني خاطئ
  AND ABS(EXTRACT(EPOCH FROM (preparation_end - preparation_start)) / 60 - preparation_time) > 1;

-- إضافة تعليق
COMMENT ON TABLE orders IS 'جدول الطلبات - تم تصحيح أوقات التحضير لتتطابق مع القيم المدخلة';
