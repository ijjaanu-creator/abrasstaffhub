-- Add date_of_birth and address columns to staff_members table
ALTER TABLE public.staff_members 
ADD COLUMN date_of_birth date,
ADD COLUMN address text;