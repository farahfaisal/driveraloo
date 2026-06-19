/*
  # نظام موافقة الأدمن على الطلبات
  
  1. التغييرات
    - إضافة عمود admin_approved في driver_waiting_list
    - تحديث دالة auto_add_to_waiting_list لدعم موافقة الأدمن
    - عندما تكون المعالجة التلقائية معطلة، يحتاج الطلب لموافقة الأدمن
  
  2. السلوك
    - إذا كانت المعالجة التلقائية مفعلة: admin_approved = true (موافقة تلقائية)
    - إذا كانت المعالجة التلقائية معطلة: admin_approved = false (يحتاج موافقة)
    - الطلبات التي admin_approved = false لن تظهر للسائقين أو البائعين
*/

-- إضافة عمود admin_approved
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_waiting_list' AND column_name = 'admin_approved'
  ) THEN
    ALTER TABLE driver_waiting_list 
    ADD COLUMN admin_approved BOOLEAN DEFAULT true;
  END IF;
END $$;

-- تحديث السجلات الموجودة
UPDATE driver_waiting_list 
SET admin_approved = true 
WHERE admin_approved IS NULL;

-- إضافة تعليق على العمود
COMMENT ON COLUMN driver_waiting_list.admin_approved IS 'هل تمت الموافقة على الطلب من قبل الأدمن (مطلوب عندما تكون المعالجة التلقائية معطلة)';

-- تحديث دالة الإضافة التلقائية لدعم موافقة الأدمن
CREATE OR REPLACE FUNCTION auto_add_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings JSONB;
  v_auto_processing BOOLEAN;
  v_auto_processing_status TEXT;
  v_exists BOOLEAN;
  v_admin_approved BOOLEAN;
BEGIN
  -- الحصول على إعدادات المعالجة التلقائية
  SELECT settings INTO v_settings
  FROM app_settings
  LIMIT 1;
  
  v_auto_processing := COALESCE((v_settings->'orders'->>'autoProcessing')::boolean, false);
  v_auto_processing_status := COALESCE(v_settings->'orders'->>'autoProcessingStatus', 'processing');
  
  -- تحديد حالة الموافقة بناءً على المعالجة التلقائية
  -- إذا كانت المعالجة التلقائية مفعلة: موافقة تلقائية من الأدمن
  -- إذا كانت معطلة: يحتاج موافقة يدوية من الأدمن
  v_admin_approved := v_auto_processing;
  
  -- إذا كانت المعالجة التلقائية مفعلة
  IF v_auto_processing THEN
    -- التحقق من أن الطلب في إحدى الحالات المناسبة
    IF NEW.status IN ('processing', 'waiting-for-driver', 'preparing') THEN
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
            admin_approved,
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
            v_admin_approved,
            COALESCE(NEW.vendor_approved, false),
            now()
          );
        END IF;
        
      ELSIF TG_TABLE_NAME = 'captain_orders' THEN
        -- التحقق من عدم وجود الطلب في القائمة
        SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE captain_order_id = NEW.id) INTO v_exists;
        
        IF NOT v_exists THEN
          INSERT INTO driver_waiting_list (
            captain_order_id, 
            vendor_id, 
            total, 
            status,
            admin_approved,
            created_at
          ) VALUES (
            NEW.id, 
            NULL, 
            NEW.delivery_fee, 
            'pending',
            v_admin_approved,
            now()
          );
        END IF;
        
      ELSIF TG_TABLE_NAME = 'parcel_orders' THEN
        -- التحقق من عدم وجود الطلب في القائمة
        SELECT EXISTS(SELECT 1 FROM driver_waiting_list WHERE parcel_order_id = NEW.id) INTO v_exists;
        
        IF NOT v_exists THEN
          INSERT INTO driver_waiting_list (
            parcel_order_id, 
            vendor_id, 
            total, 
            status,
            admin_approved,
            created_at,
            geocoded_latitude, 
            geocoded_longitude
          ) VALUES (
            NEW.id, 
            NULL, 
            NEW.delivery_fee, 
            'pending',
            v_admin_approved,
            now(),
            NEW.sender_latitude, 
            NEW.sender_longitude
          );
        END IF;
      END IF;
    END IF;
  ELSE
    -- إذا كانت المعالجة التلقائية معطلة
    -- لا نضيف الطلبات تلقائياً، ننتظر موافقة الأدمن أولاً
    RAISE NOTICE 'المعالجة التلقائية معطلة - يتطلب موافقة الأدمن على الطلب %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_driver_waiting_list_admin_approved 
ON driver_waiting_list(admin_approved) 
WHERE admin_approved = false;

-- تحديث RLS policies لإخفاء الطلبات غير الموافق عليها
DROP POLICY IF EXISTS "Drivers can view available orders" ON driver_waiting_list;

CREATE POLICY "Drivers can view available orders"
ON driver_waiting_list
FOR SELECT
TO authenticated
USING (
  status = 'pending' 
  AND admin_approved = true 
  AND (vendor_approved = true OR vendor_approved IS NULL)
  AND driver_id IS NULL
);

DROP POLICY IF EXISTS "Drivers can view their assigned orders" ON driver_waiting_list;

CREATE POLICY "Drivers can view their assigned orders"
ON driver_waiting_list
FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM drivers 
    WHERE drivers.user_id = auth.uid() 
    AND drivers.id = driver_waiting_list.driver_id
  )
);
