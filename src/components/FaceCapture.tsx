import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FaceCaptureProps {
  onCapture: (imageBase64: string) => void;
  onCancel: () => void;
  mode: 'enroll' | 'verify';
  isProcessing?: boolean;
}

export function FaceCapture({ onCapture, onCancel, mode, isProcessing = false }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const { toast } = useToast();

  // Attach stream to video element when both are available
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().then(() => {
        setCameraReady(true);
      }).catch(err => {
        console.error('Video play error:', err);
      });
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    setIsStarting(true);
    setCameraReady(false);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
    } catch (error: any) {
      console.error('Camera error:', error);
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access to use face recognition.',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Mirror the image for selfie view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageBase64);
    stopCamera();
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setCameraReady(false);
    startCamera();
  }, [startCamera]);

  const confirmCapture = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-display text-lg font-semibold">
          {mode === 'enroll' ? 'Register Your Face' : 'Verify Your Face'}
        </h2>
        <Button variant="ghost" size="icon" onClick={handleCancel} disabled={isProcessing}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Camera View */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-black">
          {/* Face guide overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 300 400">
              <ellipse
                cx="150"
                cy="180"
                rx="90"
                ry="120"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="8 4"
                className="text-primary/50"
              />
            </svg>
          </div>

          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              {/* Video element - always present when stream exists */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover absolute inset-0 ${stream && cameraReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ transform: 'scaleX(-1)' }}
              />
              
              {/* Start camera button or loading state */}
              {!stream && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <Camera className="h-16 w-16 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Camera not started</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Position your face within the oval guide
                    </p>
                  </div>
                  <Button onClick={startCamera} disabled={isStarting}>
                    {isStarting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Start Camera
                  </Button>
                </div>
              )}
              
              {/* Loading indicator while camera initializes */}
              {stream && !cameraReady && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Initializing camera...</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Instructions */}
        <p className="mt-4 text-sm text-muted-foreground text-center max-w-xs">
          {mode === 'enroll'
            ? 'Position your face within the oval. This photo will be used to verify your identity.'
            : 'Position your face within the oval to verify your identity.'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-border">
        {capturedImage ? (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={retake} disabled={isProcessing}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button className="flex-1" onClick={confirmCapture} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Confirm'}
            </Button>
          </div>
        ) : stream && cameraReady ? (
          <Button className="w-full" size="lg" onClick={capturePhoto}>
            <Camera className="h-5 w-5 mr-2" />
            Capture Photo
          </Button>
        ) : null}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
