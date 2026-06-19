/*
  # حذف جميع الـ triggers والدوال المتعلقة بـ preparation
  
  ## الهدف
  - حذف جميع الـ triggers التي تعتمد على preparation_start و preparation_end
  - استخدام CASCADE لحذف جميع التبعيات
*/

-- حذف الـ triggers
DROP TRIGGER IF EXISTS instant_preparation_time_sync ON orders CASCADE;
DROP TRIGGER IF EXISTS auto_sync_prep_time_trigger ON orders CASCADE;
DROP TRIGGER IF EXISTS set_preparation_times_orders ON orders CASCADE;
DROP TRIGGER IF EXISTS auto_set_preparation_times_on_update ON orders CASCADE;
DROP TRIGGER IF EXISTS set_preparation_start_time ON orders CASCADE;
DROP TRIGGER IF EXISTS sync_preparation_time_trigger ON orders CASCADE;

-- حذف الدوال مع CASCADE
DROP FUNCTION IF EXISTS sync_preparation_time_instantly() CASCADE;
DROP FUNCTION IF EXISTS auto_sync_preparation_time_to_actual() CASCADE;
DROP FUNCTION IF EXISTS set_preparation_times() CASCADE;
DROP FUNCTION IF EXISTS set_actual_preparation_time_on_acceptance() CASCADE;
DROP FUNCTION IF EXISTS update_preparation_start_time() CASCADE;
DROP FUNCTION IF EXISTS sync_preparation_time_to_waiting_list() CASCADE;
