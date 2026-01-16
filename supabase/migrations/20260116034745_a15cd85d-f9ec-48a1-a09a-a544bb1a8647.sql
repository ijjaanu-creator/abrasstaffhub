-- Add salary advance tracking columns to payroll_records
ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS advance_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_date DATE,
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'full' CHECK (payment_mode IN ('full', 'advance', 'balance'));

-- Create a separate table for tracking advance payment history
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_id UUID REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('advance', 'balance', 'full')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on salary_advances
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

-- RLS policies for salary_advances (admin only)
CREATE POLICY "Admins can view all salary advances"
ON public.salary_advances
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create salary advances"
ON public.salary_advances
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update salary advances"
ON public.salary_advances
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete salary advances"
ON public.salary_advances
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));