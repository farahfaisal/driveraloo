/*
  # إضافة خاصية موافقة البائع لقائمة الانتظار

  ## التغييرات
  1. إضافة عمود `vendor_approved` في `driver_waiting_list`
     - يحدد ما إذا كان البائع قد وافق على الطلب أم لا
     - القيمة الافتراضية: FALSE (لم يوافق بعد)
  
  ## التدفق الجديد (المعالجة التلقائية)
  1. طلب جديد → يُضاف فوراً لـ driver_waiting_list مع vendor_approved = FALSE
  2. السائقون يرون الطلب لكن لا يمكنهم قبوله
  3. البائع يقبل → vendor_approved = TRUE
  4. السائقون يمكنهم الآن قبول الطلب

  ## الأمان
  - RLS موجود على الجدول
  - السائقون يمكنهم رؤية الطلبات فقط
  - فقط البائع يمكنه تحديث vendor_approved
*/

-- 1. إضافة عمود vendor_approved
ALTER TABLE driver_waiting_list
ADD COLUMN IF NOT EXISTS vendor_approved BOOLEAN DEFAULT FALSE;

-- 2. تحديث الطلبات الموجودة لتكون معتمدة (لأنها وصلت لقائمة الانتظار)
UPDATE driver_waiting_list
SET vendor_approved = TRUE
WHERE vendor_approved IS NULL;

-- 3. تعديل trigger الإضافة التلقائية لقائمة الانتظار
-- الطلبات pending تُضاف مع vendor_approved = FALSE
-- الطلبات processing تُضاف مع vendor_approved = TRUE
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_vendor_approved BOOLEAN;
BEGIN
  -- تحديد حالة الموافقة بناءً على حالة الطلب
  IF NEW.status = 'pending' THEN
    v_vendor_approved := FALSE;  -- لم يوافق البائع بعد
  ELSIF NEW.status IN ('processing', 'waiting-for-driver', 'preparing') THEN
    v_vendor_approved := TRUE;   -- البائع وافق
  ELSE
    -- لا نضيف الطلب للقائمة في الحالات الأخرى
    RETURN NEW;
  END IF;
  
  -- للطلبات العادية
  IF TG_TABLE_NAME = 'orders' THEN
    -- التحقق من عدم وجود الطلب في القائمة
    SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) INTO v_exists;
    
    IF v_exists THEN
      -- تحديث الموافقة إذا كان الطلب موجود
      UPDATE driver_waiting_list
      SET vendor_approved = v_vendor_approved
      WHERE order_id = NEW.id;
    ELSE
      -- إضافة الطلب للقائمة
      INSERT INTO driver_waiting_list (
        order_id, 
        vendor_id, 
        customer_name,
        customer_phone,
        address,
        city,
        total, 
        status, 
        vendor_approved,
        created_at
      ) VALUES (
        NEW.id, 
        NEW.vendor_id, 
        NEW.customer_name,
        NEW.customer_phone,
        NEW.address,
        NEW.city,
        NEW.total, 
        'pending',
        v_vendor_approved,
        now()
      );
    END IF;
    
  -- لطلبات الكابتن
  ELSIF TG_TABLE_NAME = 'captain_orders' THEN
    SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE captain_order_id = NEW.id) INTO v_exists;
    
    IF v_exists THEN
      UPDATE driver_waiting_list
      SET vendor_approved = v_vendor_approved
      WHERE captain_order_id = NEW.id;
    ELSE
      INSERT INTO driver_waiting_list (
        captain_order_id, 
        vendor_id, 
        total, 
        status,
        vendor_approved,
        created_at
      ) VALUES (
        NEW.id, 
        NULL, 
        NEW.delivery_fee, 
        'pending',
        v_vendor_approved,
        now()
      );
    END IF;
    
  -- لطلبات الشحن
  ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
    SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = NEW.id) INTO v_exists;
    
    IF v_exists THEN
      UPDATE driver_waiting_list
      SET vendor_approved = v_vendor_approved
      WHERE parcel_order_id = NEW.id;
    ELSE
      INSERT INTO driver_waiting_list (
        parcel_order_id, 
        vendor_id, 
        total, 
        status,
        vendor_approved,
        geocoded_latitude, 
        geocoded_longitude,
        created_at
      ) VALUES (
        NEW.id, 
        NULL, 
        NEW.delivery_fee, 
        'pending',
        v_vendor_approved,
        NEW.sender_latitude, 
        NEW.sender_longitude,
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
