/*
  # Add Web Push Notification to Waiting List Trigger

  Updates the trigger function to also call notify-drivers-web-push
  in addition to notify-drivers-fcm, so PWA (browser) drivers receive
  push notifications alongside native Android/iOS drivers.
*/

CREATE OR REPLACE FUNCTION notify_drivers_fcm_via_net()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Notify native app drivers via FCM
  PERFORM net.http_post(
    url := 'https://fliwyntfvfedslbwkvks.supabase.co/functions/v1/notify-drivers-fcm',
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
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXd5bnRmdmZlZHNsYndrdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYxOTUsImV4cCI6MjA3NjM0MjE5NX0.Fxhqj4VMq_a1ZkHabPChkzTh4Ep_QqBqPS2LDq0dfLY'
    )
  );

  -- Notify PWA (browser) drivers via Web Push
  PERFORM net.http_post(
    url := 'https://fliwyntfvfedslbwkvks.supabase.co/functions/v1/notify-drivers-web-push',
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
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXd5bnRmdmZlZHNsYndrdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYxOTUsImV4cCI6MjA3NjM0MjE5NX0.Fxhqj4VMq_a1ZkHabPChkzTh4Ep_QqBqPS2LDq0dfLY'
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
