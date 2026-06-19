/*
  # إزالة وقت التحضير الافتراضي
  
  1. تعديلات
    - تحديث trigger `set_preparation_times` لعدم وضع وقت افتراضي
    - سيتم عرض وقت التحضير فقط إذا تم تحديده صراحة
    
  2. التغييرات
    - إزالة السطر الذي يضع 20 دقيقة كقيمة افتراضية
    - الاحتفاظ بباقي وظائف الـ trigger
*/

-- Update the trigger function to NOT set default preparation time
CREATE OR REPLACE FUNCTION set_preparation_times()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set preparation times when status is appropriate AND preparation_time is explicitly set
    IF (NEW.status = 'pending' OR NEW.status = 'processing' OR NEW.status = 'confirmed') 
       AND NEW.preparation_time IS NOT NULL THEN
        
        -- Set preparation_start to current time if not set
        IF NEW.preparation_start IS NULL THEN
            NEW.preparation_start := now();
        END IF;

        -- Calculate preparation_end based on preparation_time
        NEW.preparation_end := NEW.preparation_start + (NEW.preparation_time * interval '1 minute');
    END IF;

    -- Copy vendor coordinates to vendor_geocoded fields if available
    IF TG_TABLE_NAME = 'driver_waiting_list' AND NEW.vendor_id IS NOT NULL THEN
        -- Try to get vendor coordinates
        DECLARE
            vendor_lat numeric;
            vendor_lng numeric;
        BEGIN
            SELECT latitude, longitude INTO vendor_lat, vendor_lng
            FROM vendors 
            WHERE id = NEW.vendor_id;

            IF vendor_lat IS NOT NULL AND vendor_lng IS NOT NULL THEN
                NEW.vendor_geocoded_latitude := vendor_lat;
                NEW.vendor_geocoded_longitude := vendor_lng;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Silently fail and continue
                NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;