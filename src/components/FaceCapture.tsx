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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const isEmbedded = window.top !== window.self;
  const { toast } = useToast();

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraReady(false);
  }, [stream]);

  // Attach stream to the video element when it becomes available
  useEffect(() => {
    let cancelled = false;

    const attach = async () => {
      if (!stream || !videoRef.current) return;

      try {
        setCameraError(null);
        const videoEl = videoRef.current;
        videoEl.srcObject = stream;

        // Wait until the video has dimensions (some browsers never fire loadeddata here)
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('Camera preview timed out.'));
          }, 5000);

          const onReady = () => {
            if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
              cleanup();
              resolve();
            }
          };

          const cleanup = () => {
            window.clearTimeout(timeout);
            videoEl.removeEventListener('loadedmetadata', onReady);
            videoEl.removeEventListener('loadeddata', onReady);
            videoEl.removeEventListener('canplay', onReady);
            videoEl.removeEventListener('playing', onReady);
          };

          videoEl.addEventListener('loadedmetadata', onReady);
          videoEl.addEventListener('loadeddata', onReady);
          videoEl.addEventListener('canplay', onReady);
          videoEl.addEventListener('playing', onReady);

          // In case it's already ready
          onReady();
        });

        await videoEl.play();
        if (!cancelled) setCameraReady(true);
      } catch (err: any) {
        console.error('[FaceCapture] video attach/play error:', err);
        if (!cancelled) {
          setCameraReady(false);
          setCameraError(err?.message || 'Unable to start camera preview.');
        }
      }
    };

    attach();

    return () => {
      cancelled = true;
    };
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const startCamera = useCallback(async () => {
    console.log('[FaceCapture] startCamera clicked');
    setIsStarting(true);
    setCameraReady(false);
    setCameraError(null);

    try {
      if (!window.isSecureContext) {
        const msg = 'Camera requires HTTPS (or localhost).';
        setCameraError(msg);
        toast({
          title: 'Camera unavailable',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      const getUserMedia = navigator.mediaDevices?.getUserMedia;
      if (!getUserMedia) {
        const msg = 'Your browser does not support camera access.';
        setCameraError(msg);
        toast({
          title: 'Camera not supported',
          description: msg,
          variant: 'destructive',
        });
        return;
      }

      // Some environments block camera inside embedded iframes
      if (isEmbedded) {
        toast({
          title: 'Camera may be blocked in preview',
          description: 'Open the app in a new tab to allow camera access.',
        });
      }

      const mediaStream = await getUserMedia.call(navigator.mediaDevices, {
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      console.log('[FaceCapture] getUserMedia success', {
        tracks: mediaStream.getTracks().map((t) => ({ kind: t.kind, label: t.label, readyState: t.readyState })),
      });

      setStream(mediaStream);
    } catch (error: any) {
      console.error('[FaceCapture] Camera error:', error);
      const name = error?.name || 'CameraError';
      const message = error?.message || 'Unable to access camera.';

      setCameraError(`${name}: ${message}`);

      toast({
        title: `Camera error: ${name}`,
        description:
          name === 'NotAllowedError'
            ? 'Permission denied. Please allow camera access in your browser settings and try again.'
            : name === 'NotFoundError'
              ? 'No camera device was found on this device.'
              : message,
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  }, [toast, isEmbedded]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Some devices ignore the "ideal" constraint and return very large frames.
    // Clamp to a reasonable size so the verification request doesn't exceed payload limits.
    const maxDim = 720;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));

    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);

    // Mirror the image for selfie view
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const jpegQuality = mode === 'verify' ? 0.72 : 0.8;
    const imageBase64 = canvas.toDataURL('image/jpeg', jpegQuality);
    setCapturedImage(imageBase64);
    stopCamera();
  }, [stopCamera, mode]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setCameraReady(false);
    setCameraError(null);
    startCamera();
  }, [startCamera]);

  const confirmCapture = useCallback(() => {
    if (capturedImage) onCapture(capturedImage);
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
        <Button type="button" variant="ghost" size="icon" onClick={handleCancel} disabled={isProcessing}>
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
            <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover absolute inset-0 ${stream && cameraReady ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ transform: 'scaleX(-1)' }}
              />

              {!stream && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <Camera className="h-16 w-16 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Camera not started</p>
                    <p className="text-sm text-muted-foreground mt-1">Position your face within the oval guide</p>
                    {cameraError && (
                      <p className="text-xs text-muted-foreground mt-2 break-words">
                        {cameraError}
                      </p>
                    )}
                  </div>
                  <div className="w-full flex flex-col gap-2">
                    <Button type="button" onClick={startCamera} disabled={isStarting}>
                      {isStarting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      Start Camera
                    </Button>
                    {isEmbedded && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                      >
                        Open in new tab
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {stream && !cameraReady && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Initializing camera...</p>
                    {cameraError && (
                      <p className="text-xs text-muted-foreground break-words max-w-xs text-center mt-2">
                        {cameraError}
                      </p>
                    )}
                  </div>
                  <div className="w-full max-w-xs flex flex-col gap-2">
                    <Button type="button" variant="outline" onClick={stopCamera}>
                      Cancel
                    </Button>
                    {isEmbedded && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                      >
                        Open in new tab
                      </Button>
                    )}
                  </div>
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
