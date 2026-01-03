-- Add individual shift times to staff_members table
ALTER TABLE public.staff_members 
ADD COLUMN shift_start time without time zone DEFAULT '09:00:00',
ADD COLUMN shift_end time without time zone DEFAULT '17:00:00';