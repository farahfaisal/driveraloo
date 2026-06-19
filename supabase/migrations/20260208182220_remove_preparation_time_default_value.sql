/*
  # حذف القيمة الافتراضية لوقت التحضير

  1. المشكلة
    - preparation_time له default value = 20
    - يتم تعيين وقت التحضير تلقائياً عند إنشاء الطلب
    - البائع لم يحدد وقت التحضير بعد لكن المؤقت يظهر
  
  2. الحل
    - حذف default value من preparation_time
    - الآن preparation_time سيكون NULL حتى يحدده البائع
  
  3. النتيجة
    - عند إنشاء طلب جديد: preparation_time = NULL
    - المؤقت يظهر فقط بعد أن يحدد البائع وقت التحضير
*/

-- حذف القيمة الافتراضية من preparation_time
ALTER TABLE orders 
ALTER COLUMN preparation_time DROP DEFAULT;

-- التحقق من التغيير
COMMENT ON COLUMN orders.preparation_time IS 
'وقت التحضير بالدقائق - يحدده البائع عند قبول الطلب - NULL حتى يحدده البائع';
