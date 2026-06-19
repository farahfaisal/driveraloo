/*
  # إصلاح إضافة طلبات الطرود تلقائياً إلى قائمة الانتظار

  ## المشكلة
  - الـ trigger الحالي يبحث عن حالة 'waiting-for-driver' غير موجودة
  - الحالات المسموح بها: pending, pending_review, accepted, picked_up, in_transit, delivered, cancelled, rejected
  - لا يتم إضافة طلبات الطرود إلى driver_waiting_list تلقائياً

  ## الحل
  - تحديث الـ function لإضافة الطلبات بحالة 'accepted'
  - استخدام بيانات الاستلام (sender) بدلاً من بيانات التسليم (receiver)
  - مزامنة البيانات مع بنية driver_waiting_list
*/

-- حذف الـ function القديمة
DROP FUNCTION IF EXISTS add_parcel_order_to_waiting_list() CASCADE;

-- إنشاء function جديدة
CREATE OR REPLACE FUNCTION add_parcel_order_to_waiting_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- عند إنشاء طلب طرد بحالة 'accepted' أو تحديثه إلى 'accepted'
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'accepted')) THEN
    -- إضافة إلى driver_waiting_list
    INSERT INTO driver_waiting_list (
      parcel_order_id,
      order_number,
      customer_phone,
      address,
      total,
      status,
      geocoded_latitude,
      geocoded_longitude,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.order_number,
      NEW.sender_phone,           -- هاتف المرسل
      NEW.sender_address,          -- عنوان الاستلام
      NEW.delivery_fee,            -- رسوم التوصيل
      'pending',                   -- حالة البداية
      NEW.sender_latitude,         -- موقع الاستلام
      NEW.sender_longitude,
      NOW(),
      NOW()
    )
    ON CONFLICT (parcel_order_id) DO UPDATE SET
      order_number = EXCLUDED.order_number,
      customer_phone = EXCLUDED.customer_phone,
      address = EXCLUDED.address,
      total = EXCLUDED.total,
      status = EXCLUDED.status,
      geocoded_latitude = EXCLUDED.geocoded_latitude,
      geocoded_longitude = EXCLUDED.geocoded_longitude,
      updated_at = NOW();
    
    RAISE NOTICE 'Added parcel order % to waiting list', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ triggers
DROP TRIGGER IF EXISTS trigger_add_parcel_order_to_waiting_list ON parcel_orders;
CREATE TRIGGER trigger_add_parcel_order_to_waiting_list
  AFTER INSERT OR UPDATE ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION add_parcel_order_to_waiting_list();
