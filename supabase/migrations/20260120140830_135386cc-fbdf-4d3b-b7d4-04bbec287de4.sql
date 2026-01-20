-- Create a security definer function to get admin user IDs for chat
-- This allows staff to find admins without exposing the full user_roles table
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::app_role
$$;