/*
  # إصلاح ظهور الطلبات قيد التحضير للسائقين
  
  1. المشكلة
    - الطلبات التي في حالة "processing" أو "preparing" لا تظهر للسائقين
    - التريجر الحالي يعمل فقط عند التغيير من pending → accepted
    - لا يتعامل مع التغيير إلى processing أو preparing
  
  2. الحل
    - تعديل التريجر ليضيف الطلبات تلقائياً عند أي تغيير إلى:
      * accepted
      * processing
      * preparing
    - التأكد من عدم وجود تكرار في driver_waiting_list
  
  3. التأثير
    - الطلبات في أي من الحالات الثلاث ستظهر للسائقين فوراً
    - تحديث تلقائي لوقت التحضير
*/

-- تحديث التريجر ليشمل حالات processing و preparing
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
        COALESCE(NEW.preparation_end, NOW() + COALESCE(NEW.preparation_time || ' minutes', '20 minutes')::INTERVAL),
        NEW.preparation_time, 
        NEW.vendor_name
      );
    ELSE
      -- إذا كان موجود، نحدّث بياناته
      UPDATE driver_waiting_list
      SET 
        status = 'pending',
        preparation_start = COALESCE(NEW.preparation_start, NOW()),
        preparation_end = COALESCE(NEW.preparation_end, NOW() + COALESCE(NEW.preparation_time || ' minutes', '20 minutes')::INTERVAL),
        preparation_time = NEW.preparation_time,
        updated_at = NOW()
      WHERE order_id = NEW.id
      AND status != 'accepted'; -- لا نغير الطلبات المقبولة من السائقين
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
