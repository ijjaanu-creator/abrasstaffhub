-- Create a security definer function to check if user is an office accountant
CREATE OR REPLACE FUNCTION public.is_office_accountant(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = _user_id
      AND lower(position) = 'accountant'
      AND lower(department) = 'office'
  )
$$;

-- Allow accountants to view all staff members (read-only)
CREATE POLICY "Accountants can view all staff"
ON public.staff_members
FOR SELECT TO authenticated
USING (public.is_office_accountant(auth.uid()));

-- Allow accountants to view all payroll records (read-only)
CREATE POLICY "Accountants can view all payroll"
ON public.payroll_records
FOR SELECT TO authenticated
USING (public.is_office_accountant(auth.uid()));

-- Allow accountants to view all attendance records (read-only)
CREATE POLICY "Accountants can view all attendance"
ON public.attendance_records
FOR SELECT TO authenticated
USING (public.is_office_accountant(auth.uid()));

-- Allow accountants to view all salary advances (read-only)
CREATE POLICY "Accountants can view all salary advances"
ON public.salary_advances
FOR SELECT TO authenticated
USING (public.is_office_accountant(auth.uid()));

-- Allow accountants to view app settings (read-only)
CREATE POLICY "Accountants can view app settings"
ON public.app_settings
FOR SELECT TO authenticated
USING (public.is_office_accountant(auth.uid()));