/*
  # إصلاح trigger لاستخدام حالة 'accepted' بدلاً من 'assigned'

  ## المشكلة
  - الـ trigger يحاول تحديث حالة parcel_orders إلى 'assigned' 
  - لكن جدول parcel_orders يقبل فقط: pending, pending_review, accepted, picked_up, in_transit, delivered, cancelled, rejected

  ## الحل
  - تحديث الـ trigger ليستخدم 'accepted' بدلاً من 'assigned'
*/

-- تحديث الـ function لاستخدام حالة 'accepted'
CREATE OR REPLACE FUNCTION public.handle_parcel_order_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_waiting_list_id uuid;
  v_trip_id uuid;
BEGIN
  -- عندما تتحول الحالة إلى 'accepted' وهناك driver_id
  IF NEW.status = 'accepted' AND NEW.driver_id IS NOT NULL 
     AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    
    -- تحديث قائمة الانتظار
    SELECT id INTO v_waiting_list_id
    FROM driver_waiting_list
    WHERE parcel_order_id = NEW.id;
    
    IF v_waiting_list_id IS NOT NULL THEN
      UPDATE driver_waiting_list
      SET 
        driver_id = NEW.driver_id,
        status = 'accepted',
        updated_at = NOW()
      WHERE id = v_waiting_list_id;
    END IF;
    
    -- إنشاء رحلة السائق
    IF NOT EXISTS (
      SELECT 1 FROM driver_trips WHERE parcel_order_id = NEW.id
    ) THEN
      INSERT INTO driver_trips (
        parcel_order_id,
        order_number,
        driver_id,
        status,
        customer_name,
        customer_phone,
        pickup_address,
        delivery_address,
        total,
        notes,
        assigned_at,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.order_number,
        NEW.driver_id,
        'assigned',
        NEW.receiver_name,
        NEW.receiver_phone,
        NEW.sender_address,
        NEW.receiver_address,
        NEW.delivery_fee,
        COALESCE(NEW.description, NEW.notes, 'طلب طرد'),
        COALESCE(NEW.accepted_at, NOW()),
        NOW(),
        NOW()
      )
      RETURNING id INTO v_trip_id;
      
      RAISE NOTICE 'Created driver trip % for parcel %', v_trip_id, NEW.order_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- التأكد من أن الـ trigger موجود
DROP TRIGGER IF EXISTS trigger_handle_parcel_acceptance ON parcel_orders;
CREATE TRIGGER trigger_handle_parcel_acceptance
  AFTER UPDATE ON parcel_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_parcel_order_acceptance();
