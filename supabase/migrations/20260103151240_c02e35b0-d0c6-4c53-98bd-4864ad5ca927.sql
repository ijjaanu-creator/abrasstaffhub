-- Create table for face re-registration requests
CREATE TABLE public.face_reregistration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.face_reregistration_requests ENABLE ROW LEVEL SECURITY;

-- Admins can manage all requests
CREATE POLICY "Admins can manage face requests"
ON public.face_reregistration_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view their own requests
CREATE POLICY "Staff can view own requests"
ON public.face_reregistration_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM staff_members
  WHERE staff_members.id = face_reregistration_requests.staff_id
  AND staff_members.user_id = auth.uid()
));

-- Staff can insert their own requests
CREATE POLICY "Staff can create own requests"
ON public.face_reregistration_requests
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM staff_members
  WHERE staff_members.id = face_reregistration_requests.staff_id
  AND staff_members.user_id = auth.uid()
));