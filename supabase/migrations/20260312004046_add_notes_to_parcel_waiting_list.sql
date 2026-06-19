/*
  # إضافة الملاحظات عند إضافة طلبات الطرود لقائمة الانتظار

  ## المشكلة
  - حقل description من parcel_orders لا يُنسخ إلى driver_waiting_list
  - السائقون لا يرون وصف الطرد أو ملاحظاته

  ## الحل
  - تحديث الـ function لنسخ description إلى notes
  - عرض تفاصيل الطرد للسائقين
*/

-- تحديث الـ function لإضافة الملاحظات
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
      notes,
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
      COALESCE(NEW.description, NEW.notes, 'طلب طرد - ' || COALESCE(NEW.parcel_type, 'غير محدد')),  -- الوصف/الملاحظات
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
      notes = EXCLUDED.notes,
      status = EXCLUDED.status,
      geocoded_latitude = EXCLUDED.geocoded_latitude,
      geocoded_longitude = EXCLUDED.geocoded_longitude,
      updated_at = NOW();
    
    RAISE NOTICE 'Added parcel order % to waiting list with notes', NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$;
