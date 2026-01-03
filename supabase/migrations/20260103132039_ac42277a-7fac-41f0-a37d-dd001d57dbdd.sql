-- Create a secure function to link a staff member to a user account
CREATE OR REPLACE FUNCTION public.link_staff_to_user(
  _staff_id uuid,
  _user_id uuid,
  _email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE staff_members
  SET user_id = _user_id, email = _email
  WHERE id = _staff_id AND user_id IS NULL;
  
  RETURN FOUND;
END;
$$;