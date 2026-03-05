
-- Function to mark absent for all active staff who have no attendance record for a given date
CREATE OR REPLACE FUNCTION public.mark_absent_for_date(_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO attendance_records (staff_id, date, status, check_in, check_out, work_hours, overtime)
  SELECT sm.id, _date, 'absent', NULL, NULL, 0, 0
  FROM staff_members sm
  WHERE sm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.staff_id = sm.id AND ar.date = _date
    );
END;
$$;

-- Cron job: run daily at 23:55 to mark absent staff for today
SELECT cron.schedule(
  'mark-absent-daily',
  '55 23 * * *',
  $$SELECT public.mark_absent_for_date(CURRENT_DATE)$$
);

-- Backfill: mark absent for all past working days in the last 90 days
DO $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '90 days',
      CURRENT_DATE - INTERVAL '1 day',
      '1 day'::interval
    )::date
  LOOP
    -- Skip weekends (optional - remove if your staff works 7 days)
    -- IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      PERFORM public.mark_absent_for_date(d);
    -- END IF;
  END LOOP;
END;
$$;
