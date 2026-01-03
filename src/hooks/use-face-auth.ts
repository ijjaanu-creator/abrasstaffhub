import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FaceAuthResult {
  isEnrolling: boolean;
  isVerifying: boolean;
  enrollFace: (userId: string, staffId: string, imageBase64: string) => Promise<boolean>;
  verifyFace: (enrolledImageUrl: string, capturedImageBase64: string) => Promise<boolean>;
}

export function useFaceAuth(): FaceAuthResult {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const enrollFace = useCallback(async (
    userId: string,
    staffId: string,
    imageBase64: string
  ): Promise<boolean> => {
    setIsEnrolling(true);

    try {
      // Convert base64 to blob
      const response = await fetch(imageBase64);
      const blob = await response.blob();

      // Upload to Supabase storage
      const fileName = `${userId}/face_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('face-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('[face-auth] Upload error:', uploadError);
        toast({
          title: 'Upload failed',
          description: 'Could not save your face image. Please try again.',
          variant: 'destructive',
        });
        return false;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('face-images')
        .getPublicUrl(fileName);

      // For private buckets, we need to create a signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('face-images')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (signedUrlError) {
        console.error('[face-auth] Signed URL error:', signedUrlError);
        toast({
          title: 'Setup failed',
          description: 'Could not complete face registration.',
          variant: 'destructive',
        });
        return false;
      }

      // Update staff member with face image URL
      const { error: updateError } = await supabase
        .from('staff_members')
        .update({ face_image_url: signedUrlData.signedUrl })
        .eq('id', staffId);

      if (updateError) {
        console.error('[face-auth] Update error:', updateError);
        toast({
          title: 'Registration failed',
          description: 'Could not save face registration.',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Face registered!',
        description: 'Your face has been enrolled for attendance verification.',
      });
      return true;

    } catch (error: any) {
      console.error('[face-auth] Enrollment error:', error);
      toast({
        title: 'Enrollment failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsEnrolling(false);
    }
  }, [toast]);

  const verifyFace = useCallback(async (
    enrolledImageUrl: string,
    capturedImageBase64: string
  ): Promise<boolean> => {
    setIsVerifying(true);

    try {
      // Ensure user is authenticated before calling the protected edge function
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to verify your face.',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('verify-face', {
        body: {
          enrolledImageUrl,
          capturedImageBase64,
        },
      });

      if (error) {
        console.error('[face-auth] Verification invoke error:', error);
        // Check for auth-related errors
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('unauthorized') || errorMsg.includes('401') || errorMsg.includes('jwt')) {
          toast({
            title: 'Session expired',
            description: 'Please log in again to continue.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Verification failed',
            description: error.message || 'Could not verify your face.',
            variant: 'destructive',
          });
        }
        return false;
      }

      // Server returns 200 even on failures, with { error, reason }
      if (data?.error) {
        toast({
          title: 'Verification failed',
          description: data.reason || data.error || 'Could not verify your face.',
          variant: 'destructive',
        });
        return false;
      }

      if (data?.match) {
        toast({
          title: 'Identity verified',
          description: `Face matched with ${Math.round((data.confidence || 0) * 100)}% confidence.`,
        });
        return true;
      }

      toast({
        title: 'Face not recognized',
        description: data?.reason || 'The captured face does not match your enrolled face.',
        variant: 'destructive',
      });
      return false;
    } catch (error: any) {
      console.error('[face-auth] Verification error:', error);
      toast({
        title: 'Verification failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [toast]);

  return {
    isEnrolling,
    isVerifying,
    enrollFace,
    verifyFace,
  };
}
