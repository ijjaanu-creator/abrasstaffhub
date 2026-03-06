
-- Create holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Admins can manage holidays
CREATE POLICY "Admins can manage holidays" ON public.holidays
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view holidays
CREATE POLICY "Anyone can view holidays" ON public.holidays
FOR SELECT TO authenticated
USING (true);

-- Update mark_absent_for_date to handle holidays and Sundays
CREATE OR REPLACE FUNCTION public.mark_absent_for_date(_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_holiday boolean;
BEGIN
  -- Check if the date is a Sunday or a defined holiday
  _is_holiday := (EXTRACT(DOW FROM _date) = 0) OR EXISTS (
    SELECT 1 FROM public.holidays WHERE holidays.date = _date
  );

  INSERT INTO attendance_records (staff_id, date, status, check_in, check_out, work_hours, overtime)
  SELECT sm.id, _date,
    CASE WHEN _is_holiday THEN 'holiday' ELSE 'absent' END,
    NULL, NULL, 0, 0
  FROM staff_members sm
  WHERE sm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.staff_id = sm.id AND ar.date = _date
    );
END;
$function$;
