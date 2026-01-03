-- Add column to store biometric credential ID
ALTER TABLE public.staff_members 
ADD COLUMN IF NOT EXISTS biometric_credential_id text,
ADD COLUMN IF NOT EXISTS biometric_public_key text,
ADD COLUMN IF NOT EXISTS biometric_enrolled_at timestamp with time zone;