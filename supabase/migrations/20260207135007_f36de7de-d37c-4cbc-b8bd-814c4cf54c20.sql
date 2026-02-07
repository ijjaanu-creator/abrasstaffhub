-- Add optional additional_jobs column to staff_members
ALTER TABLE public.staff_members
ADD COLUMN additional_jobs text[] DEFAULT '{}';
