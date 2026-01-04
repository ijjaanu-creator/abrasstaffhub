import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TRACKING_INTERVAL_MS = 5000; // 5 seconds

interface LocationTrackingOptions {
  staffId: string;
  attendanceId: string;
}

export function useLocationTracking() {
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const optionsRef = useRef<LocationTrackingOptions | null>(null);
  const lastRecordedAtRef = useRef<number>(0);
  const hasShownErrorRef = useRef(false);

  const recordLocation = useCallback(async (position: GeolocationPosition) => {
    if (!optionsRef.current) return;

    const { staffId, attendanceId } = optionsRef.current;
    const { latitude, longitude, accuracy } = position.coords;

    try {
      const { error } = await supabase.from('executive_locations').insert({
        staff_id: staffId,
        attendance_id: attendanceId,
        latitude,
        longitude,
        accuracy,
        recorded_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error recording location:', error);
        if (!hasShownErrorRef.current) {
          hasShownErrorRef.current = true;
          toast({
            title: 'Location tracking issue',
            description: 'We could not save your location. Please check permissions and try again.',
            variant: 'destructive',
          });
        }
      } else {
        lastRecordedAtRef.current = Date.now();
        console.log('Location recorded:', { latitude, longitude });
      }
    } catch (err) {
      console.error('Failed to record location:', err);
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        toast({
          title: 'Location tracking issue',
          description: 'We could not save your location. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const startTracking = useCallback(
    async (options: LocationTrackingOptions) => {
      if (!navigator.geolocation) {
        toast({
          title: 'Location not supported',
          description: 'Your browser does not support geolocation.',
          variant: 'destructive',
        });
        return false;
      }

      // Reset error state for a new tracking session
      hasShownErrorRef.current = false;
      lastRecordedAtRef.current = 0;
      optionsRef.current = options;

      // Wrap initial permission / first fix in a promise so we can reliably know if tracking started.
      return await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await recordLocation(position);
            setIsTracking(true);
            resolve(true);

            // Continuous tracking, throttled to at most once per TRACKING_INTERVAL_MS
            watchIdRef.current = navigator.geolocation.watchPosition(
              async (pos) => {
                const now = Date.now();
                if (now - lastRecordedAtRef.current >= TRACKING_INTERVAL_MS) {
                  await recordLocation(pos);
                }
              },
              (error) => {
                console.error('Watch position error:', error);
              },
              {
                enableHighAccuracy: true,
                maximumAge: 10000,
              }
            );

            // Fallback periodic check in case watchPosition is throttled by the OS/browser.
            intervalRef.current = setInterval(() => {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  await recordLocation(pos);
                },
                (error) => {
                  console.error('Get position error:', error);
                },
                {
                  enableHighAccuracy: true,
                  timeout: 15000,
                  maximumAge: 0,
                }
              );
            }, TRACKING_INTERVAL_MS);

            toast({
              title: 'Location tracking started',
              description: 'Your location is being tracked while checked in.',
            });
          },
          (error) => {
            console.error('Initial position error:', error);
            let message = 'Unable to get your location.';
            if (error.code === error.PERMISSION_DENIED) {
              message = 'Location permission denied. Please enable location access.';
            }
            toast({
              title: 'Location Error',
              description: message,
              variant: 'destructive',
            });
            resolve(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      });
    },
    [recordLocation, toast]
  );

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    optionsRef.current = null;
    setIsTracking(false);
    console.log('Location tracking stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    startTracking,
    stopTracking,
    isTracking,
  };
}
