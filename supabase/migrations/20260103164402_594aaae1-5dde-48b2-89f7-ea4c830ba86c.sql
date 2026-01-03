-- Create table for storing live location updates of Executive staff
CREATE TABLE public.executive_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast lookups by staff and attendance
CREATE INDEX idx_executive_locations_staff_id ON public.executive_locations(staff_id);
CREATE INDEX idx_executive_locations_attendance_id ON public.executive_locations(attendance_id);
CREATE INDEX idx_executive_locations_recorded_at ON public.executive_locations(recorded_at DESC);

-- Enable RLS
ALTER TABLE public.executive_locations ENABLE ROW LEVEL SECURITY;

-- Admins can view all locations
CREATE POLICY "Admins can manage executive locations"
ON public.executive_locations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can insert their own location
CREATE POLICY "Staff can insert own location"
ON public.executive_locations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = executive_locations.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

-- Staff can view their own locations
CREATE POLICY "Staff can view own locations"
ON public.executive_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff_members
    WHERE staff_members.id = executive_locations.staff_id
    AND staff_members.user_id = auth.uid()
  )
);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.executive_locations;