/*
  # Update Captain Request Order Number Format

  ## Changes
  
  1. **Update Order Number Format**
     - Change from "CR000001" to "CAP-YYYYMMDD-XXXX" format
     - Example: CAP-20260203-9521
  
  2. **Update Trigger Function**
     - Generate order numbers with date and sequential number
     - Format: CAP-[DATE]-[4-digit counter]
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS set_captain_request_order_number ON captain_requests;
DROP FUNCTION IF EXISTS generate_captain_request_number_trigger();

-- Create new function with updated format
CREATE OR REPLACE FUNCTION generate_captain_request_number_trigger()
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
      SUBSTRING(order_number FROM 'CAP-\d{8}-(\d{4})') AS INTEGER
    )
  ), 0) + 1
  INTO sequence_num
  FROM captain_requests
  WHERE order_number LIKE 'CAP-' || date_part || '-%';
  
  -- If no records for today, start from a random number between 1000-9999 for variety
  IF sequence_num = 1 THEN
    sequence_num := 1000 + floor(random() * 9000)::INTEGER;
  END IF;
  
  -- Generate the order number
  new_order_number := 'CAP-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  -- Set the order number
  NEW.order_number := new_order_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_captain_request_order_number
  BEFORE INSERT ON captain_requests
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_captain_request_number_trigger();

-- Update existing records to new format using a CTE
WITH numbered_requests AS (
  SELECT 
    id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(created_at, 'YYYYMMDD') 
      ORDER BY created_at
    ) as row_num
  FROM captain_requests
  WHERE order_number LIKE 'CR%'
)
UPDATE captain_requests cr
SET order_number = 
  'CAP-' || 
  TO_CHAR(nr.created_at, 'YYYYMMDD') || 
  '-' || 
  LPAD((1000 + nr.row_num + floor(random() * 100)::INTEGER)::TEXT, 4, '0')
FROM numbered_requests nr
WHERE cr.id = nr.id;
