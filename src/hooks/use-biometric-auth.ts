import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

interface BiometricAuthResult {
  isSupported: boolean;
  isAuthenticating: boolean;
  isEnrolling: boolean;
  enroll: (staffId: string, userName: string) => Promise<boolean>;
  verify: (credentialId: string) => Promise<boolean>;
}

export function useBiometricAuth(): BiometricAuthResult {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const { toast } = useToast();

  // Check if WebAuthn/biometric is supported
  const isSupported = typeof window !== 'undefined' && 
    'PublicKeyCredential' in window &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential;

  // Enroll a new biometric credential
  const enroll = useCallback(async (staffId: string, userName: string): Promise<boolean> => {
    setIsEnrolling(true);

    try {
      if (!isSupported) {
        toast({
          title: 'Biometric not supported',
          description: 'Your device does not support biometric authentication.',
          variant: 'destructive',
        });
        return false;
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (!available) {
        toast({
          title: 'Biometric not available',
          description: 'Please set up fingerprint or face recognition in your device settings first.',
          variant: 'destructive',
        });
        return false;
      }

      // Create a unique user ID from staff ID
      const userId = new TextEncoder().encode(staffId);
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential with biometric
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Abras Staff Hub',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: userName,
            displayName: userName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Use built-in biometric (fingerprint/face)
            userVerification: 'required',        // Require biometric verification
            residentKey: 'required',             // Store credential on device
            requireResidentKey: true,
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        toast({
          title: 'Enrollment failed',
          description: 'Could not create biometric credential.',
          variant: 'destructive',
        });
        return false;
      }

      // Get the credential ID to store in database
      const credentialId = arrayBufferToBase64(credential.rawId);
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0));

      // Save credential to database
      const { error } = await supabase
        .from('staff_members')
        .update({
          biometric_credential_id: credentialId,
          biometric_public_key: publicKey,
          biometric_enrolled_at: new Date().toISOString(),
        })
        .eq('id', staffId);

      if (error) {
        console.error('Failed to save biometric:', error);
        toast({
          title: 'Enrollment failed',
          description: 'Could not save biometric data.',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Biometric enrolled!',
        description: 'Your fingerprint/face has been registered successfully.',
      });
      return true;

    } catch (error: any) {
      console.error('Biometric enrollment error:', error);
      
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'Enrollment cancelled',
          description: 'Biometric enrollment was cancelled.',
          variant: 'destructive',
        });
      } else if (error.name === 'SecurityError') {
        toast({
          title: 'Security error',
          description: 'Biometric requires a secure connection (HTTPS).',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Enrollment failed',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      }
      
      return false;
    } finally {
      setIsEnrolling(false);
    }
  }, [isSupported, toast]);

  // Verify against enrolled biometric
  const verify = useCallback(async (credentialId: string): Promise<boolean> => {
    setIsAuthenticating(true);

    try {
      if (!isSupported) {
        toast({
          title: 'Biometric not supported',
          description: 'Your device does not support biometric authentication.',
          variant: 'destructive',
        });
        return false;
      }

      if (!credentialId) {
        toast({
          title: 'No biometric enrolled',
          description: 'Please enroll your fingerprint or face first.',
          variant: 'destructive',
        });
        return false;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Convert stored credential ID back to ArrayBuffer
      const allowCredentials = [{
        id: base64ToArrayBuffer(credentialId),
        type: 'public-key' as const,
        transports: ['internal' as const],
      }];

      // Verify with existing credential
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: 'required',
          rpId: window.location.hostname,
          allowCredentials,
        },
      });

      if (assertion) {
        toast({
          title: 'Identity verified',
          description: 'Biometric verification successful.',
        });
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Biometric verification error:', error);
      
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'Verification cancelled',
          description: 'Biometric verification was cancelled or denied.',
          variant: 'destructive',
        });
      } else if (error.name === 'InvalidStateError' || error.name === 'NotFoundError') {
        toast({
          title: 'Biometric not recognized',
          description: 'This device does not have your enrolled biometric. Please use the same device you enrolled with.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Verification failed',
          description: error.message || 'Please try again.',
          variant: 'destructive',
        });
      }
      
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [isSupported, toast]);

  return {
    isSupported,
    isAuthenticating,
    isEnrolling,
    enroll,
    verify,
  };
}
