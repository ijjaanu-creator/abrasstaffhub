import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface BiometricAuthResult {
  isSupported: boolean;
  isAuthenticating: boolean;
  authenticate: () => Promise<boolean>;
}

export function useBiometricAuth(): BiometricAuthResult {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { toast } = useToast();

  // Check if WebAuthn/biometric is supported
  const isSupported = typeof window !== 'undefined' && 
    'PublicKeyCredential' in window &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential;

  const authenticate = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);

    try {
      // Check if platform authenticator (fingerprint/face) is available
      if (!isSupported) {
        toast({
          title: 'Biometric not supported',
          description: 'Your device does not support biometric authentication. Please use a device with fingerprint or face recognition.',
          variant: 'destructive',
        });
        return false;
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      
      if (!available) {
        toast({
          title: 'Biometric not available',
          description: 'No fingerprint or face recognition found on this device. Please set up biometric authentication in your device settings.',
          variant: 'destructive',
        });
        return false;
      }

      // Create a challenge for WebAuthn
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Use WebAuthn to verify the user's identity using biometric
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Abras Staff Hub',
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16),
            name: 'staff-attendance',
            displayName: 'Staff Attendance',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Use built-in biometric
            userVerification: 'required',        // Require biometric verification
            residentKey: 'discouraged',
          },
          timeout: 60000,
          attestation: 'none',
        },
      });

      if (credential) {
        toast({
          title: 'Biometric verified',
          description: 'Your identity has been confirmed.',
        });
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Biometric auth error:', error);
      
      // Handle specific error cases
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'Authentication cancelled',
          description: 'Biometric verification was cancelled or denied.',
          variant: 'destructive',
        });
      } else if (error.name === 'SecurityError') {
        toast({
          title: 'Security error',
          description: 'Biometric authentication requires a secure connection (HTTPS).',
          variant: 'destructive',
        });
      } else if (error.name === 'InvalidStateError') {
        // User already has a credential, try to use it instead
        try {
          const getCredential = await navigator.credentials.get({
            publicKey: {
              challenge: new Uint8Array(32),
              timeout: 60000,
              userVerification: 'required',
              rpId: window.location.hostname,
            },
          });
          
          if (getCredential) {
            toast({
              title: 'Biometric verified',
              description: 'Your identity has been confirmed.',
            });
            return true;
          }
        } catch (getError) {
          console.error('Get credential error:', getError);
        }
        
        toast({
          title: 'Verification failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Biometric failed',
          description: error.message || 'Unable to verify your identity. Please try again.',
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
    authenticate,
  };
}
