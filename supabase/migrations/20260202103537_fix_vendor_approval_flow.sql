/*
  # إصلاح تدفق موافقة البائع على الطلبات

  ## المشكلة
  - النظام حالياً يقبل الطلبات تلقائياً بدون موافقة البائع
  - الطلبات تذهب للسائقين مباشرة بدون أن يقبلها البائع

  ## التغييرات
  1. إيقاف المعالجة التلقائية للطلبات (autoProcessing = false)
  2. تعديل trigger إضافة الطلبات لقائمة الانتظار ليعمل على UPDATE أيضاً
  3. إزالة trigger المعالجة التلقائية للطلبات الجديدة

  ## التدفق الصحيح
  1. طلب جديد → pending (البائع يراه فقط)
  2. البائع يقبل → processing (الآن يُضاف لقائمة السائقين)
  3. سائق يقبل → accepted
  4. سائق يبدأ التوصيل → shipping
  5. سائق يوصل → delivered/completed

  ## الأمان
  - الـ RLS موجود على جميع الجداول
  - البائع فقط يستطيع تحديث طلباته
*/

-- 1. إيقاف المعالجة التلقائية للطلبات
UPDATE app_settings
SET settings = jsonb_set(
  settings,
  '{orders,autoProcessing}',
  'false'::jsonb
)
WHERE EXISTS (
  SELECT 1 FROM app_settings
  WHERE settings->'orders'->>'autoProcessing' = 'true'
);

-- 2. إزالة trigger المعالجة التلقائية (لكن نبقي الوظيفة للاستخدام المستقبلي)
DROP TRIGGER IF EXISTS auto_process_order_trigger ON orders;
DROP TRIGGER IF EXISTS trigger_auto_process_order ON orders;

-- 3. تعديل trigger إضافة الطلبات لقائمة الانتظار ليعمل على UPDATE أيضاً
DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON orders;

CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

-- 4. تعديل الوظيفة لتعمل على UPDATE أيضاً
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- فقط عندما تتغير الحالة إلى processing أو waiting-for-driver أو preparing
  -- (أي عندما يقبل البائع الطلب)
  IF NEW.status IN ('processing', 'waiting-for-driver', 'preparing') THEN
    
    -- للطلبات العادية
    IF TG_TABLE_NAME = 'orders' THEN
      -- التحقق من عدم وجود الطلب في القائمة
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          order_id, 
          vendor_id, 
          customer_name,
          customer_phone,
          address,
          city,
          total, 
          status, 
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
          now()
        );
      END IF;
      
    -- لطلبات الكابتن
    ELSIF TG_TABLE_NAME = 'captain_orders' THEN
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE captain_order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          captain_order_id, 
          vendor_id, 
          total, 
          status, 
          created_at
        ) VALUES (
          NEW.id, 
          NULL, 
          NEW.delivery_fee, 
          'pending', 
          now()
        );
      END IF;
      
    -- لطلبات الشحن
    ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
      SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = NEW.id) INTO v_exists;
      
      IF NOT v_exists THEN
        INSERT INTO driver_waiting_list (
          parcel_order_id, 
          vendor_id, 
          total, 
          status, 
          created_at,
          geocoded_latitude, 
          geocoded_longitude
        ) VALUES (
          NEW.id, 
          NULL, 
          NEW.delivery_fee, 
          'pending', 
          now(),
          NEW.sender_latitude, 
          NEW.sender_longitude
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. تطبيق نفس المنطق على captain_orders و parcel_orders
DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON captain_orders;
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT OR UPDATE OF status ON captain_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();

DROP TRIGGER IF EXISTS auto_add_to_waiting_list_trigger ON parcel_orders;
CREATE TRIGGER auto_add_to_waiting_list_trigger
  AFTER INSERT OR UPDATE OF status ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_to_waiting_list();
