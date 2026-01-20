-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can check phone existence" ON public.staff_members;

-- Create a secure function to check phone existence without exposing other data
-- This function only returns true/false, not the actual data
CREATE OR REPLACE FUNCTION public.check_phone_exists(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE phone = _phone
  )
$$;