-- Add location tracking toggle to staff_members
ALTER TABLE public.staff_members 
ADD COLUMN track_location boolean NOT NULL DEFAULT false;