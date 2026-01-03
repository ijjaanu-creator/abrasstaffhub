import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBiometricAuth } from '@/hooks/use-biometric-auth';
import { Fingerprint, ScanFace, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';

interface BiometricEnrollmentProps {
  staffId: string;
  staffName: string;
  onComplete: () => void;
  isEnrolled?: boolean;
}

export function BiometricEnrollment({ 
  staffId, 
  staffName, 
  onComplete,
  isEnrolled = false 
}: BiometricEnrollmentProps) {
  const { enroll, isEnrolling, isSupported } = useBiometricAuth();
  const [enrolled, setEnrolled] = useState(isEnrolled);

  const handleEnroll = async () => {
    const success = await enroll(staffId, staffName);
    if (success) {
      setEnrolled(true);
      onComplete();
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-center">
        <ScanFace className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h3 className="font-semibold text-lg mb-2">Biometric Not Supported</h3>
        <p className="text-sm text-muted-foreground">
          Your device does not support biometric authentication. 
          Please use a device with fingerprint or face recognition.
        </p>
      </div>
    );
  }

  if (enrolled) {
    return (
      <div className="rounded-xl border border-success/50 bg-success/10 p-6 text-center">
        <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
        <h3 className="font-semibold text-lg mb-2">Biometric Enrolled</h3>
        <p className="text-sm text-muted-foreground">
          Your fingerprint/face is registered. You can now use it for attendance.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center space-y-6">
      <div className="flex justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Fingerprint className="h-8 w-8 text-primary" />
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ScanFace className="h-8 w-8 text-primary" />
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl font-semibold mb-2">
          Register Your Biometric
        </h3>
        <p className="text-sm text-muted-foreground">
          For secure attendance tracking, please register your fingerprint or face.
          This will be used to verify your identity when checking in and out.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-left">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Your biometric data stays on your device</p>
            <p className="text-muted-foreground">
              We only store a secure reference ID, not your actual fingerprint or face data.
            </p>
          </div>
        </div>
      </div>

      <Button 
        size="lg" 
        className="w-full" 
        onClick={handleEnroll}
        disabled={isEnrolling}
      >
        {isEnrolling ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Enrolling...
          </>
        ) : (
          <>
            <ScanFace className="h-5 w-5 mr-2" />
            Enroll Fingerprint / Face
          </>
        )}
      </Button>
    </div>
  );
}
