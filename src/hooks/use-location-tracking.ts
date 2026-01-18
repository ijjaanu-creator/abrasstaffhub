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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const optionsRef = useRef<LocationTrackingOptions | null>(null);
  const lastRecordedAtRef = useRef<number>(0);
  const hasShownErrorRef = useRef(false);
  const isRecordingRef = useRef(false);

  const recordLocation = useCallback(async (position: GeolocationPosition) => {
    if (!optionsRef.current) return;
    if (isRecordingRef.current) return; // Prevent concurrent recordings

    const { staffId, attendanceId } = optionsRef.current;
    const { latitude, longitude, accuracy } = position.coords;

    // Skip if accuracy is too poor (>500m)
    if (accuracy > 500) {
      console.log('Skipping location record - accuracy too poor:', accuracy);
      return;
    }

    // Throttle: don't record more often than every 5 seconds
    const now = Date.now();
    if (now - lastRecordedAtRef.current < TRACKING_INTERVAL_MS) {
      return;
    }

    isRecordingRef.current = true;

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
            description: 'Could not save location. Check permissions.',
            variant: 'destructive',
          });
        }
      } else {
        lastRecordedAtRef.current = now;
        console.log('Location recorded:', { latitude, longitude, accuracy });
      }
    } catch (err) {
      console.error('Failed to record location:', err);
      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        toast({
          title: 'Location tracking issue',
          description: 'Could not save location. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      isRecordingRef.current = false;
    }
  }, [toast]);

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

  const startTracking = useCallback(
    async (options: LocationTrackingOptions): Promise<boolean> => {
      // If already tracking with same options, don't restart
      if (
        isTracking &&
        optionsRef.current?.staffId === options.staffId &&
        optionsRef.current?.attendanceId === options.attendanceId
      ) {
        console.log('Already tracking this attendance session');
        return true;
      }

      // Stop any existing tracking first
      stopTracking();

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

      return await new Promise<boolean>((resolve) => {
        let resolved = false;

        const handleInitialSuccess = async (position: GeolocationPosition) => {
          if (resolved) return;
          resolved = true;

          console.log('Initial location obtained:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });

          await recordLocation(position);
          setIsTracking(true);

          // Start continuous tracking with watchPosition
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              recordLocation(pos);
            },
            (error) => {
              console.error('Watch position error:', error.message);
            },
            {
              enableHighAccuracy: true,
              maximumAge: 10000,
              timeout: 30000,
            }
          );

          // Fallback interval for devices where watchPosition is throttled
          intervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => recordLocation(pos),
              (error) => console.log('Interval position error:', error.message),
              {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000,
              }
            );
          }, TRACKING_INTERVAL_MS);

          toast({
            title: 'Location tracking started',
            description: 'Your location is being tracked while checked in.',
          });

          resolve(true);
        };

        const handleInitialError = (error: GeolocationPositionError) => {
          if (resolved) return;
          resolved = true;

          console.error('Initial position error:', error.code, error.message);

          let message = 'Unable to get your location.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location permission denied. Please enable location access.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Location unavailable. Please ensure GPS is enabled.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Location request timed out. Please try again.';
          }

          toast({
            title: 'Location Error',
            description: message,
            variant: 'destructive',
          });
          resolve(false);
        };

        // Try getCurrentPosition first
        navigator.geolocation.getCurrentPosition(
          handleInitialSuccess,
          (error) => {
            // If high accuracy fails, try with lower accuracy
            console.log('High accuracy failed, trying low accuracy:', error.message);
            navigator.geolocation.getCurrentPosition(
              handleInitialSuccess,
              handleInitialError,
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000,
              }
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 10000,
          }
        );

        // Final timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            toast({
              title: 'Location Timeout',
              description: 'Could not get location. Please check GPS settings.',
              variant: 'destructive',
            });
            resolve(false);
          }
        }, 20000);
      });
    },
    [isTracking, recordLocation, stopTracking, toast]
  );

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
