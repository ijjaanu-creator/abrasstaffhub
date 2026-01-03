-- Add face image URL column to staff_members
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS face_image_url text;

-- Create storage bucket for face images
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-images', 'face-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for face images bucket
CREATE POLICY "Staff can upload their own face image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'face-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can view their own face image"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'face-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all face images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'face-images' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Staff can update their own face image"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'face-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can delete their own face image"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'face-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);