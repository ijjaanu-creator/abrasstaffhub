-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Everyone can view departments
CREATE POLICY "Anyone can view departments"
ON public.departments
FOR SELECT
USING (true);

-- Only admins can manage departments
CREATE POLICY "Admins can manage departments"
ON public.departments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default departments
INSERT INTO public.departments (name) VALUES 
  ('Production'),
  ('Packaging'),
  ('Quality Control'),
  ('Sales'),
  ('Administration'),
  ('Warehouse');