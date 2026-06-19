/*
  # Backfill pending settlements for completed trips without settlements

  ## Summary
  Some trips were completed before the auto-settlement system was added.
  This migration creates pending settlement records for all completed trips
  that do not already have a settlement linked via trip_id.

  ## What it does
  - Finds all driver_trips with status = 'completed' that have no matching settlement
  - Creates a 'pending' settlement for each one using the order's delivery_fee
  - Falls back to trip.total if delivery_fee is 0 or null
  - Covers: store orders (order_id), parcel orders (parcel_order_id), captain requests (captain_request_id)
  - Driver commission_rate is fetched from the drivers table (default 0 if missing)
*/

-- Store orders: trips linked to orders table
INSERT INTO driver_settlements (
  driver_id,
  trip_id,
  order_number,
  period_start,
  period_end,
  total_delivery_fees,
  store_commission,
  driver_earnings,
  total_trips,
  commission_rate,
  is_settled,
  settlement_status,
  payment_method,
  settlement_notes,
  created_at,
  updated_at
)
SELECT
  dt.driver_id,
  dt.id AS trip_id,
  COALESCE(o.order_number, dt.order_number) AS order_number,
  dt.completed_at AS period_start,
  dt.completed_at AS period_end,
  CASE WHEN COALESCE(o.delivery_fee, 0) > 0 THEN o.delivery_fee ELSE COALESCE(dt.total, 0) END AS total_delivery_fees,
  ROUND(
    CASE WHEN COALESCE(o.delivery_fee, 0) > 0 THEN o.delivery_fee ELSE COALESCE(dt.total, 0) END
    * COALESCE(d.commission_rate, 0) / 100,
    2
  ) AS store_commission,
  ROUND(
    (CASE WHEN COALESCE(o.delivery_fee, 0) > 0 THEN o.delivery_fee ELSE COALESCE(dt.total, 0) END)
    - (
      CASE WHEN COALESCE(o.delivery_fee, 0) > 0 THEN o.delivery_fee ELSE COALESCE(dt.total, 0) END
      * COALESCE(d.commission_rate, 0) / 100
    ),
    2
  ) AS driver_earnings,
  1 AS total_trips,
  COALESCE(d.commission_rate, 0) AS commission_rate,
  false AS is_settled,
  'pending' AS settlement_status,
  'cash' AS payment_method,
  '' AS settlement_notes,
  COALESCE(dt.completed_at, now()) AS created_at,
  now() AS updated_at
FROM driver_trips dt
JOIN orders o ON o.id = dt.order_id
JOIN drivers d ON d.id = dt.driver_id
WHERE dt.status = 'completed'
  AND dt.order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_settlements ds WHERE ds.trip_id = dt.id
  );

-- Parcel orders: trips linked to parcel_orders table
INSERT INTO driver_settlements (
  driver_id,
  trip_id,
  order_number,
  period_start,
  period_end,
  total_delivery_fees,
  store_commission,
  driver_earnings,
  total_trips,
  commission_rate,
  is_settled,
  settlement_status,
  payment_method,
  settlement_notes,
  created_at,
  updated_at
)
SELECT
  dt.driver_id,
  dt.id AS trip_id,
  dt.order_number,
  dt.completed_at AS period_start,
  dt.completed_at AS period_end,
  CASE WHEN COALESCE(po.delivery_fee, 0) > 0 THEN po.delivery_fee ELSE COALESCE(dt.total, 0) END AS total_delivery_fees,
  ROUND(
    CASE WHEN COALESCE(po.delivery_fee, 0) > 0 THEN po.delivery_fee ELSE COALESCE(dt.total, 0) END
    * COALESCE(d.commission_rate, 0) / 100,
    2
  ) AS store_commission,
  ROUND(
    (CASE WHEN COALESCE(po.delivery_fee, 0) > 0 THEN po.delivery_fee ELSE COALESCE(dt.total, 0) END)
    - (
      CASE WHEN COALESCE(po.delivery_fee, 0) > 0 THEN po.delivery_fee ELSE COALESCE(dt.total, 0) END
      * COALESCE(d.commission_rate, 0) / 100
    ),
    2
  ) AS driver_earnings,
  1 AS total_trips,
  COALESCE(d.commission_rate, 0) AS commission_rate,
  false AS is_settled,
  'pending' AS settlement_status,
  'cash' AS payment_method,
  '' AS settlement_notes,
  COALESCE(dt.completed_at, now()) AS created_at,
  now() AS updated_at
FROM driver_trips dt
JOIN parcel_orders po ON po.id = dt.parcel_order_id
JOIN drivers d ON d.id = dt.driver_id
WHERE dt.status = 'completed'
  AND dt.parcel_order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_settlements ds WHERE ds.trip_id = dt.id
  );

-- Captain requests: trips linked to captain_requests table
INSERT INTO driver_settlements (
  driver_id,
  trip_id,
  order_number,
  period_start,
  period_end,
  total_delivery_fees,
  store_commission,
  driver_earnings,
  total_trips,
  commission_rate,
  is_settled,
  settlement_status,
  payment_method,
  settlement_notes,
  created_at,
  updated_at
)
SELECT
  dt.driver_id,
  dt.id AS trip_id,
  dt.order_number,
  dt.completed_at AS period_start,
  dt.completed_at AS period_end,
  COALESCE(cr.final_fare, cr.estimated_fare, dt.total, 0) AS total_delivery_fees,
  ROUND(
    COALESCE(cr.final_fare, cr.estimated_fare, dt.total, 0)
    * COALESCE(d.commission_rate, 0) / 100,
    2
  ) AS store_commission,
  ROUND(
    COALESCE(cr.final_fare, cr.estimated_fare, dt.total, 0)
    - (COALESCE(cr.final_fare, cr.estimated_fare, dt.total, 0) * COALESCE(d.commission_rate, 0) / 100),
    2
  ) AS driver_earnings,
  1 AS total_trips,
  COALESCE(d.commission_rate, 0) AS commission_rate,
  false AS is_settled,
  'pending' AS settlement_status,
  'cash' AS payment_method,
  '' AS settlement_notes,
  COALESCE(dt.completed_at, now()) AS created_at,
  now() AS updated_at
FROM driver_trips dt
JOIN captain_requests cr ON cr.id = dt.captain_request_id
JOIN drivers d ON d.id = dt.driver_id
WHERE dt.status = 'completed'
  AND dt.captain_request_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM driver_settlements ds WHERE ds.trip_id = dt.id
  );
