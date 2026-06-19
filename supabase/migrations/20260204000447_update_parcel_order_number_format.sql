/*
  # Update Parcel Order Number Format

  ## Changes
  
  1. **Update Order Number Format**
     - Change from "P000001" to "PAR-YYYYMMDD-XXXX" format
     - Example: PAR-20260203-4521
  
  2. **Update Trigger Function**
     - Generate order numbers with date and sequential number
     - Format: PAR-[DATE]-[4-digit counter]
*/

-- Drop existing triggers and function
DROP TRIGGER IF EXISTS before_insert_parcel_order ON parcel_orders;
DROP TRIGGER IF EXISTS trigger_set_parcel_order_number ON parcel_orders;
DROP FUNCTION IF EXISTS set_parcel_order_number();

-- Create new function with updated format
CREATE OR REPLACE FUNCTION set_parcel_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part TEXT;
  sequence_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Get date part in YYYYMMDD format
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'PAR-\d{8}-(\d{4})') AS INTEGER
    )
  ), 0) + 1
  INTO sequence_num
  FROM parcel_orders
  WHERE order_number LIKE 'PAR-' || date_part || '-%';
  
  -- If no records for today, start from a random number between 1000-9999 for variety
  IF sequence_num = 1 THEN
    sequence_num := 1000 + floor(random() * 9000)::INTEGER;
  END IF;
  
  -- Generate the order number
  new_order_number := 'PAR-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  -- Set the order number
  NEW.order_number := new_order_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_parcel_order_number
  BEFORE INSERT ON parcel_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION set_parcel_order_number();

-- Update existing records to new format
WITH numbered_parcels AS (
  SELECT 
    id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(created_at, 'YYYYMMDD') 
      ORDER BY created_at
    ) as row_num
  FROM parcel_orders
  WHERE order_number LIKE 'P%' OR order_number NOT LIKE 'PAR-%'
)
UPDATE parcel_orders po
SET order_number = 
  'PAR-' || 
  TO_CHAR(np.created_at, 'YYYYMMDD') || 
  '-' || 
  LPAD((1000 + np.row_num + floor(random() * 100)::INTEGER)::TEXT, 4, '0')
FROM numbered_parcels np
WHERE po.id = np.id;
