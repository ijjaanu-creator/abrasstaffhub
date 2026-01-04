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

  const recordLocation = useCallback(async (position: GeolocationPosition) => {
    if (!optionsRef.current) return;

    const { staffId, attendanceId } = optionsRef.current;
    const { latitude, longitude, accuracy } = position.coords;

    try {
      const { error } = await supabase
        .from('executive_locations')
        .insert({
          staff_id: staffId,
          attendance_id: attendanceId,
          latitude,
          longitude,
          accuracy,
          recorded_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error recording location:', error);
      } else {
        console.log('Location recorded:', { latitude, longitude });
      }
    } catch (err) {
      console.error('Failed to record location:', err);
    }
  }, []);

  const startTracking = useCallback(async (options: LocationTrackingOptions) => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return false;
    }

    optionsRef.current = options;

    // Get initial location
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await recordLocation(position);
        setIsTracking(true);

        // Start continuous tracking with watchPosition for more accurate updates
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            // Only record if we don't have an interval running
            // This prevents duplicate entries
          },
          (error) => {
            console.error('Watch position error:', error);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
          }
        );

        // Set up interval for periodic location updates
        intervalRef.current = setInterval(async () => {
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
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return true;
  }, [recordLocation, toast]);

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
