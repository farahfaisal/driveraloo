/*
  # إصلاح حساب وقت التحضير بشكل صحيح

  1. المشكلة
    - عند حساب preparation_end، يتم استخدام تركيبة معقدة قد تسبب أخطاء
    - القيمة الافتراضية 20 دقيقة قد تُستخدم بدلاً من القيمة الفعلية
    - الوقت المحسوب لا يتطابق مع preparation_time الذي أدخله البائع

  2. الحل
    - تبسيط الحساب باستخدام ضرب عددي بدلاً من دمج النصوص
    - استخدام INTERVAL '1 minute' بشكل صريح وآمن
    - التأكد من أن الوقت المحسوب = preparation_time بالضبط

  3. التأثير
    - الوقت المعروض للسائق سيطابق الوقت الذي أدخله البائع
    - حسابات أكثر دقة ووضوحاً
*/

-- إعادة إنشاء التريجر بحساب صحيح لوقت التحضير
CREATE OR REPLACE FUNCTION on_admin_accept_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- عند تغيير الحالة إلى accepted أو processing أو preparing
  IF NEW.status IN ('accepted', 'processing', 'preparing') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'processing', 'preparing')) THEN
    
    -- التحقق من عدم وجود السجل مسبقاً
    IF NOT EXISTS (SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) THEN
      -- إضافة للقائمة بحالة pending (جاهز للسائقين مباشرة)
      INSERT INTO driver_waiting_list (
        order_id, 
        vendor_id, 
        order_number, 
        customer_name, 
        customer_phone,
        address, 
        city,
        total, 
        payment_method, 
        notes, 
        status, 
        preparation_start,
        preparation_end,
        preparation_time, 
        vendor_name
      ) VALUES (
        NEW.id, 
        NEW.vendor_id, 
        NEW.order_number, 
        NEW.customer_name, 
        NEW.customer_phone,
        NEW.address,
        NEW.city,
        NEW.total, 
        NEW.payment_method, 
        NEW.notes, 
        'pending',  -- جاهز للسائقين فوراً
        COALESCE(NEW.preparation_start, NOW()),
        -- إصلاح الحساب: استخدام ضرب عددي بدلاً من دمج النصوص
        COALESCE(NEW.preparation_end, NOW() + (COALESCE(NEW.preparation_time, 20) * INTERVAL '1 minute')),
        NEW.preparation_time, 
        NEW.vendor_name
      );
    ELSE
      -- إذا كان موجود، نحدّث بياناته
      UPDATE driver_waiting_list
      SET 
        status = 'pending',
        preparation_start = COALESCE(NEW.preparation_start, NOW()),
        -- إصلاح الحساب: استخدام ضرب عددي بدلاً من دمج النصوص
        preparation_end = COALESCE(NEW.preparation_end, NOW() + (COALESCE(NEW.preparation_time, 20) * INTERVAL '1 minute')),
        preparation_time = NEW.preparation_time,
        updated_at = NOW()
      WHERE order_id = NEW.id
      AND status != 'accepted'; -- لا نغير الطلبات المقبولة من السائقين
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- التأكد من أن التريجر موجود ومفعّل
DROP TRIGGER IF EXISTS on_admin_accept_order_trigger ON orders;
CREATE TRIGGER on_admin_accept_order_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION on_admin_accept_order();

-- إضافة تعليق على التريجر
COMMENT ON FUNCTION on_admin_accept_order() IS 
'يضيف الطلبات تلقائياً إلى قائمة انتظار السائقين عند قبولها من الإدارة أو البائع، مع حساب صحيح لوقت التحضير';
