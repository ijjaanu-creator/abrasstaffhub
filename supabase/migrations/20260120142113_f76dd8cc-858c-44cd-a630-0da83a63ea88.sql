-- Create a secure function for staff signup that returns only necessary data
-- This validates phone exists, checks if already linked, and returns staff_id
CREATE OR REPLACE FUNCTION public.validate_staff_signup(_phone text)
RETURNS TABLE(staff_id uuid, already_linked boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id as staff_id,
    (sm.user_id IS NOT NULL) as already_linked
  FROM public.staff_members sm
  WHERE sm.phone = _phone
  LIMIT 1;
END;
$$;