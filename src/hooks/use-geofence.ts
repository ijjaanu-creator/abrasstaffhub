import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

// Allowed locations (converted from DMS to decimal degrees)
// 1. 10°44'44.8"N 76°02'31.0"E = 10.745778, 76.041944
// 2. 10°44'05.5"N 76°01'39.0"E = 10.734861, 76.027500
const ALLOWED_LOCATIONS = [
  { lat: 10.745778, lng: 76.041944, name: 'Location 1' },
  { lat: 10.734861, lng: 76.027500, name: 'Location 2' },
];

const MAX_DISTANCE_METERS = 100;

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGeofence() {
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const calculateMinDistance = useCallback((latitude: number, longitude: number) => {
    let minDistance = Infinity;
    for (const loc of ALLOWED_LOCATIONS) {
      const distance = calculateDistance(latitude, longitude, loc.lat, loc.lng);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return minDistance;
  }, []);

  const finishCheck = useCallback((
    position: GeolocationPosition,
    resolve: (value: boolean) => void
  ) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    
    cleanup();
    
    const { latitude, longitude } = position.coords;
    const minDistance = calculateMinDistance(latitude, longitude);
    
    console.log('Location check complete:', {
      latitude,
      longitude,
      accuracy: position.coords.accuracy,
      distance: Math.round(minDistance),
    });

    setCurrentDistance(Math.round(minDistance));
    const isWithin = minDistance <= MAX_DISTANCE_METERS;
    setIsWithinGeofence(isWithin);
    setIsChecking(false);

    if (!isWithin) {
      toast({
        title: 'Outside allowed area',
        description: `You are ${Math.round(minDistance)}m away. Must be within ${MAX_DISTANCE_METERS}m of office location.`,
        variant: 'destructive',
      });
    }

    resolve(isWithin);
  }, [cleanup, calculateMinDistance, toast]);

  const handleError = useCallback((
    error: GeolocationPositionError,
    resolve: (value: boolean) => void,
    bestPosition: GeolocationPosition | null
  ) => {
    if (resolvedRef.current) return;
    
    // If we have any position at all, use it
    if (bestPosition) {
      finishCheck(bestPosition, resolve);
      return;
    }

    resolvedRef.current = true;
    cleanup();
    setIsChecking(false);
    setIsWithinGeofence(false);

    let message = 'Unable to get your location.';
    if (error.code === error.PERMISSION_DENIED) {
      message = 'Location permission denied. Please enable location access in your device settings.';
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      message = 'Location unavailable. Please ensure GPS is enabled and try again.';
    } else if (error.code === error.TIMEOUT) {
      message = 'Location request timed out. Please move to an open area and try again.';
    }

    console.error('Geolocation error:', error.code, error.message);
    toast({
      title: 'Location Error',
      description: message,
      variant: 'destructive',
    });
    resolve(false);
  }, [cleanup, finishCheck, toast]);

  const checkLocation = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      // Reset state
      resolvedRef.current = false;
      setIsChecking(true);
      setIsWithinGeofence(null);

      if (!navigator.geolocation) {
        toast({
          title: 'Location not supported',
          description: 'Your browser does not support geolocation.',
          variant: 'destructive',
        });
        setIsChecking(false);
        setIsWithinGeofence(false);
        resolve(false);
        return;
      }

      // Clear any existing watcher
      cleanup();

      let bestPosition: GeolocationPosition | null = null;
      let attempts = 0;
      const maxAttempts = 5;

      // Strategy 1: Try getCurrentPosition first (works better on some devices)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Initial getCurrentPosition success:', {
            accuracy: position.coords.accuracy,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          
          bestPosition = position;
          
          // If accuracy is good enough (<100m), use it immediately
          if (position.coords.accuracy <= 100) {
            finishCheck(position, resolve);
            return;
          }
          
          // Otherwise, start watching for better accuracy
          startWatching();
        },
        (error) => {
          console.log('Initial getCurrentPosition failed, starting watch:', error.message);
          // Fall back to watchPosition
          startWatching();
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 10000, // Accept cached position up to 10 seconds old
        }
      );

      function startWatching() {
        if (resolvedRef.current) return;

        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            if (resolvedRef.current) return;
            
            attempts++;
            console.log(`Watch position update #${attempts}:`, {
              accuracy: position.coords.accuracy,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });

            // Track the best (most accurate) position
            if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
              bestPosition = position;
            }

            // Accept if accuracy is good enough or we've had enough attempts
            if (position.coords.accuracy <= 100 || attempts >= maxAttempts) {
              finishCheck(bestPosition, resolve);
            }
          },
          (error) => {
            console.error('Watch position error:', error.message);
            // Don't immediately fail - wait for timeout to use best position
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 5000,
          }
        );

        // Fallback timeout: After 6 seconds, use best available position
        setTimeout(() => {
          if (resolvedRef.current) return;
          
          if (bestPosition) {
            console.log('Using best available position after timeout');
            finishCheck(bestPosition, resolve);
          } else {
            // Try one more time with lower accuracy
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (resolvedRef.current) return;
                finishCheck(position, resolve);
              },
              (error) => {
                handleError(error, resolve, null);
              },
              {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000, // Accept position up to 1 minute old
              }
            );
          }
        }, 6000);

        // Final timeout: Give up after 12 seconds total
        setTimeout(() => {
          if (resolvedRef.current) return;
          
          if (bestPosition) {
            finishCheck(bestPosition, resolve);
          } else {
            resolvedRef.current = true;
            cleanup();
            setIsChecking(false);
            setIsWithinGeofence(false);
            toast({
              title: 'Location Timeout',
              description: 'Could not get your location. Please check GPS is enabled and try again.',
              variant: 'destructive',
            });
            resolve(false);
          }
        }, 12000);
      }
    });
  }, [toast, cleanup, finishCheck, handleError]);

  return {
    checkLocation,
    isChecking,
    isWithinGeofence,
    currentDistance,
    maxDistance: MAX_DISTANCE_METERS,
  };
}
