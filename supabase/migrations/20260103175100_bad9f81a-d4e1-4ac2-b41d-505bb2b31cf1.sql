-- Create a secure bootstrap for the very first admin account
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only allow bootstrapping if there is no admin yet
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Allow any authenticated user to call it (it will only work for the first admin)
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;