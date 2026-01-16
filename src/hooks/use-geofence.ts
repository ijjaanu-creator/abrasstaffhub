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

  const processPosition = useCallback((
    position: GeolocationPosition,
    resolve: (value: boolean) => void,
    stopWatching: () => void
  ) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Find the closest allowed location
    let minDistance = Infinity;
    let closestLocation = '';

    for (const loc of ALLOWED_LOCATIONS) {
      const distance = calculateDistance(latitude, longitude, loc.lat, loc.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestLocation = loc.name;
      }
    }

    // Only accept position if accuracy is reasonable (< 150m) or we've been waiting too long
    // For iPhone 7 and older devices, we accept lower accuracy
    if (accuracy > 200) {
      console.log(`Waiting for better accuracy. Current: ${accuracy}m`);
      return; // Keep watching for better accuracy
    }

    stopWatching();
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
  }, [toast]);

  const checkLocation = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      setIsChecking(true);

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
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      const stopWatching = () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };

      let hasResolved = false;
      let bestPosition: GeolocationPosition | null = null;

      const handleSuccess = (position: GeolocationPosition) => {
        if (hasResolved) return;

        // Keep track of the best position we've received
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }

        // Accept if accuracy is good enough
        if (position.coords.accuracy <= 150) {
          hasResolved = true;
          processPosition(position, resolve, stopWatching);
        }
      };

      const handleError = (error: GeolocationPositionError) => {
        if (hasResolved) return;
        
        // If we have any position, use it even if not ideal
        if (bestPosition) {
          hasResolved = true;
          processPosition(bestPosition, resolve, stopWatching);
          return;
        }

        stopWatching();
        setIsChecking(false);
        setIsWithinGeofence(false);
        
        let message = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please enable location access in Settings > Safari > Location.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information unavailable. Please ensure GPS is enabled.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Please try again.';
        }

        toast({
          title: 'Location Error',
          description: message,
          variant: 'destructive',
        });
        hasResolved = true;
        resolve(false);
      };

      // Use watchPosition for better accuracy on iOS devices (especially iPhone 7)
      // This allows the GPS to "warm up" and provide more accurate readings
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout for older devices
          maximumAge: 0,
        }
      );

      // Fallback: After 8 seconds, use the best position we have
      setTimeout(() => {
        if (!hasResolved) {
          if (bestPosition) {
            hasResolved = true;
            processPosition(bestPosition, resolve, stopWatching);
          } else {
            // Try one more time with lower accuracy requirement
            navigator.geolocation.getCurrentPosition(
              (position) => {
                if (!hasResolved) {
                  hasResolved = true;
                  processPosition(position, resolve, stopWatching);
                }
              },
              (error) => {
                if (!hasResolved) {
                  hasResolved = true;
                  handleError(error);
                }
              },
              {
                enableHighAccuracy: false, // Try with lower accuracy as fallback
                timeout: 5000,
                maximumAge: 30000, // Accept cached position up to 30 seconds old
              }
            );
          }
        }
      }, 8000);

      // Final timeout after 15 seconds
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          stopWatching();
          setIsChecking(false);
          setIsWithinGeofence(false);
          toast({
            title: 'Location Timeout',
            description: 'Could not get your location. Please check your GPS settings and try again.',
            variant: 'destructive',
          });
          resolve(false);
        }
      }, 15000);
    });
  }, [toast, processPosition]);

  return {
    checkLocation,
    isChecking,
    isWithinGeofence,
    currentDistance,
    maxDistance: MAX_DISTANCE_METERS,
  };
}
