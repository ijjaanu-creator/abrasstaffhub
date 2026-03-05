
-- Drop old check constraint and add updated one with 'holiday'
ALTER TABLE public.attendance_records DROP CONSTRAINT attendance_records_status_check;
ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_records_status_check 
  CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'half-day'::text, 'holiday'::text]));

-- Backfill: update existing 'absent' records on Sundays to 'holiday'
UPDATE attendance_records
SET status = 'holiday'
WHERE status = 'absent'
  AND EXTRACT(DOW FROM date) = 0;
