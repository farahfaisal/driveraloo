/*
  # إشعارات FCM للسائقين عند إضافة طلب لقائمة الانتظار

  ## التغييرات
  - إنشاء دالة notify_drivers_fcm_via_net تستدعي edge function عبر pg_net
  - ربط trigger على driver_waiting_list عند INSERT لإرسال إشعار لجميع السائقين
*/

-- دالة ترسل إشعار FCM لجميع السائقين عبر edge function
CREATE OR REPLACE FUNCTION notify_drivers_fcm_via_net()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- فقط عند إضافة طلب جديد بحالة pending
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.service_role_key', true);

  -- استدعاء edge function عبر pg_net (بشكل غير متزامن)
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/notify-drivers-fcm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'title', 'طلب جديد!',
      'body', 'طلب #' || COALESCE(NEW.order_number, '') || ' - ' || COALESCE(NEW.customer_name, 'عميل') || ' - ' || COALESCE(NEW.address, ''),
      'data', jsonb_build_object(
        'type', 'new_order',
        'order_id', COALESCE(NEW.order_id::text, ''),
        'order_number', COALESCE(NEW.order_number, ''),
        'customer_name', COALESCE(NEW.customer_name, ''),
        'address', COALESCE(NEW.address, ''),
        'total', COALESCE(NEW.total::text, '0')
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- لا نمنع الإدراج إذا فشل الإشعار
  RAISE WARNING 'FCM notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ربط trigger جديد على driver_waiting_list
DROP TRIGGER IF EXISTS trigger_notify_drivers_on_new_order ON driver_waiting_list;

CREATE TRIGGER trigger_notify_drivers_on_new_order
  AFTER INSERT ON driver_waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION notify_drivers_fcm_via_net();
