import { useState, useCallback } from 'react';
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

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
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
        },
        (error) => {
          setIsChecking(false);
          setIsWithinGeofence(false);
          
          let message = 'Unable to get your location.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location permission denied. Please enable location access.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Location information unavailable.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Location request timed out.';
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
  }, [toast]);

  return {
    checkLocation,
    isChecking,
    isWithinGeofence,
    currentDistance,
    maxDistance: MAX_DISTANCE_METERS,
  };
}
