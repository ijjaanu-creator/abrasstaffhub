-- Create app_settings table for admin settings
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text DEFAULT 'Abras Natural Spices',
  work_start_time time DEFAULT '09:00:00',
  work_end_time time DEFAULT '18:00:00',
  late_threshold integer DEFAULT 15,
  half_day_hours integer DEFAULT 4,
  full_day_hours integer DEFAULT 8,
  overtime_rate numeric DEFAULT 1.5,
  enable_notifications boolean DEFAULT true,
  enable_email_alerts boolean DEFAULT false,
  enable_auto_checkout boolean DEFAULT true,
  auto_checkout_time time DEFAULT '20:00:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage app settings"
ON public.app_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();