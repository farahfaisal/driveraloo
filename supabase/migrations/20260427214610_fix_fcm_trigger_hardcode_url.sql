/*
  # إصلاح trigger FCM - استخدام URL ثابت

  ## التغييرات
  - تحديث دالة notify_drivers_fcm_via_net لاستخدام URL ثابت للمشروع
  - استخدام service_role_key من supabase secrets
*/

CREATE OR REPLACE FUNCTION notify_drivers_fcm_via_net()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- فقط عند إضافة طلب جديد بحالة pending
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- استدعاء edge function عبر pg_net (بشكل غير متزامن)
  PERFORM net.http_post(
    url := 'https://fliwyntfvfedslbwkvks.supabase.co/functions/v1/notify-drivers-fcm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
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
  RAISE WARNING 'FCM notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
