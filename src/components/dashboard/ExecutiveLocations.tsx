import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, RefreshCw, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ExecutiveLocation {
  id: string;
  staff_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  staff_name: string;
  staff_position: string;
  check_in: string | null;
}

// Custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: hsl(var(--primary)); width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export function ExecutiveLocations() {

  // Fetch current locations for Executive staff who are checked in
  const { data: locations, refetch, isLoading } = useQuery({
    queryKey: ['executive-locations'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      // Get all Executive staff who are checked in today (have check_in but no check_out)
      const { data: checkedInExecutives, error: staffError } = await supabase
        .from('staff_members')
        .select(`
          id,
          name,
          position,
          department
        `)
        .eq('department', 'Executive');

      if (staffError) throw staffError;

      if (!checkedInExecutives || checkedInExecutives.length === 0) {
        return [];
      }

      // Get today's attendance for these staff members
      const { data: attendance, error: attError } = await supabase
        .from('attendance_records')
        .select('id, staff_id, check_in, check_out')
        .eq('date', today)
        .in('staff_id', checkedInExecutives.map(s => s.id))
        .is('check_out', null);

      if (attError) throw attError;

      const checkedInStaffIds = attendance?.map(a => a.staff_id) || [];

      if (checkedInStaffIds.length === 0) {
        return [];
      }

      // Get latest location for each checked-in executive
      const locationPromises = checkedInStaffIds.map(async (staffId) => {
        const { data: loc } = await supabase
          .from('executive_locations')
          .select('*')
          .eq('staff_id', staffId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return loc;
      });

      const latestLocations = await Promise.all(locationPromises);
      const validLocations = latestLocations.filter(Boolean);

      // Combine with staff info
      return validLocations.map(loc => {
        const staff = checkedInExecutives.find(s => s.id === loc.staff_id);
        const att = attendance?.find(a => a.staff_id === loc.staff_id);
        return {
          ...loc,
          staff_name: staff?.name || 'Unknown',
          staff_position: staff?.position || 'Unknown',
          check_in: att?.check_in || null,
        } as ExecutiveLocation;
      });
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('executive-locations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'executive_locations',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Executive Live Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasLocations = locations && locations.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Executive Live Locations
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {locations?.length || 0} tracked
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map View */}
        <div className="relative h-64 rounded-lg overflow-hidden border">
          {hasLocations ? (
            <MapContainer
              center={[locations[0].latitude, locations[0].longitude]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {locations.map((loc) => (
                <Marker
                  key={loc.id}
                  position={[loc.latitude, loc.longitude]}
                  icon={createCustomIcon()}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{loc.staff_name}</p>
                      <p className="text-muted-foreground">{loc.staff_position}</p>
                      <p className="text-xs mt-1">
                        Updated {formatDistanceToNow(new Date(loc.recorded_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-muted">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">
                No executives currently checked in
              </p>
            </div>
          )}
        </div>
        {hasLocations ? (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Currently Tracked</h4>
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{loc.staff_name}</p>
                    <Badge variant="secondary" className="text-xs">
                      Executive
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{loc.staff_position}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(loc.recorded_at), { addSuffix: true })}
                    </span>
                    {loc.check_in && (
                      <span>
                        Checked in: {loc.check_in}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No Executive staff currently checked in
          </div>
        )}
      </CardContent>
    </Card>
  );
}
