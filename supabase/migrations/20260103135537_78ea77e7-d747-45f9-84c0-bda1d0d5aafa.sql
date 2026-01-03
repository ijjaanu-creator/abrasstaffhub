-- Allow staff to update their own face_image_url
CREATE POLICY "Staff can update their own face"
ON public.staff_members
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());