/*
  # إظهار الطلبات المقبولة للسائقين فوراً
  
  1. المشكلة
    - عندما يقبل البائع الطلب (accepted)، لا يظهر للسائقين
    - الطلب يُضاف بحالة 'preparing_pending_vendor' بدلاً من 'pending'
    - يجب الانتظار حتى يبدأ البائع التحضير (processing) ليظهر للسائقين
  
  2. الحل
    - تعديل trigger on_admin_accept_order ليضع الطلب بحالة 'pending' مباشرة
    - حذف حالة 'preparing_pending_vendor' غير الضرورية
    - إضافة preparation_start فوراً عند القبول
  
  3. التأثير
    - الطلبات المقبولة من البائع ستظهر للسائقين فوراً
    - لن يحتاج البائع لتغيير الحالة إلى processing
*/

-- تحديث trigger قبول الطلب من الأدمن/البائع
CREATE OR REPLACE FUNCTION on_admin_accept_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- فقط عند تغيير الحالة من pending إلى accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
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
        total, 
        payment_method, 
        notes, 
        status, 
        preparation_start,
        preparation_end,
        preparation_time, 
        vendor_name, 
        items_data
      ) VALUES (
        NEW.id, 
        NEW.vendor_id, 
        NEW.order_number, 
        NEW.customer_name, 
        NEW.customer_phone,
        NEW.address, 
        NEW.total, 
        NEW.payment_method, 
        NEW.notes, 
        'pending',  -- جاهز للسائقين فوراً
        NOW(),  -- بدء التحضير فوراً
        NOW() + (NEW.preparation_time || ' minutes')::INTERVAL,  -- وقت انتهاء التحضير
        NEW.preparation_time, 
        NEW.vendor_name, 
        NEW.items_data
      );
    ELSE
      -- إذا كان موجود، نحدّث حالته إلى pending
      UPDATE driver_waiting_list
      SET 
        status = 'pending',
        preparation_start = NOW(),
        preparation_end = NOW() + (NEW.preparation_time || ' minutes')::INTERVAL,
        updated_at = NOW()
      WHERE order_id = NEW.id
      AND status = 'preparing_pending_vendor';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- تحديث أي طلبات موجودة حالياً بحالة preparing_pending_vendor
UPDATE driver_waiting_list
SET 
  status = 'pending',
  preparation_start = NOW(),
  preparation_end = NOW() + (preparation_time || ' minutes')::INTERVAL,
  updated_at = NOW()
WHERE status = 'preparing_pending_vendor';
