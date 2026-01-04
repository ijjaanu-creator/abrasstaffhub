import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, Mail, Phone, Building2, Calendar, Briefcase, 
  MapPin, Loader2, CheckCircle2, XCircle, ArrowLeft,
  Navigation, Clock, Shield, Cake, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function StaffVerify() {
  const [searchParams] = useSearchParams();
  const staffId = searchParams.get('id');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: staffMember, isLoading, error } = useQuery({
    queryKey: ['verify-staff', staffId],
    queryFn: async () => {
      if (!staffId) return null;
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('employee_id', staffId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  const { data: profile } = useQuery({
    queryKey: ['verify-staff-profile', staffMember?.user_id],
    queryFn: async () => {
      if (!staffMember?.user_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', staffMember.user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.user_id,
  });

  const { data: latestLocation, refetch: refetchLocation } = useQuery({
    queryKey: ['verify-staff-location', staffMember?.id],
    queryFn: async () => {
      if (!staffMember?.id || !staffMember?.track_location) return null;
      const { data } = await supabase
        .from('executive_locations')
        .select('*')
        .eq('staff_id', staffMember.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id && staffMember?.track_location,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying staff member...</p>
        </div>
      </div>
    );
  }

  if (error || !staffMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Staff Not Found</h1>
            <p className="mt-2 text-muted-foreground">
              The QR code is invalid or the staff member no longer exists in the system.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isActive = staffMember.status === 'active';
  const locationAge = latestLocation 
    ? Math.floor((new Date().getTime() - new Date(latestLocation.recorded_at).getTime()) / 60000)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-primary">Staff Verification</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{format(currentTime, 'HH:mm:ss')}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Verification Status */}
        <div className={`rounded-2xl p-4 ${isActive ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isActive ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
              <CheckCircle2 className={`h-6 w-6 ${isActive ? 'text-green-600' : 'text-yellow-600'}`} />
            </div>
            <div>
              <p className={`font-semibold ${isActive ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                {isActive ? 'Verified Staff Member' : 'Staff Inactive'}
              </p>
              <p className="text-sm text-muted-foreground">
                ID: {staffMember.employee_id}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-2xl border shadow-lg overflow-hidden">
          {/* Avatar & Name Header */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted shadow-md">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={staffMember.name} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                    <span className="font-display text-2xl font-bold text-primary">
                      {staffMember.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-xl font-bold text-foreground truncate">
                  {staffMember.name}
                </h1>
                <p className="text-primary font-medium">{staffMember.position}</p>
                <Badge 
                  variant={isActive ? 'default' : 'secondary'}
                  className="mt-2"
                >
                  {staffMember.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DetailItem 
                icon={Building2} 
                label="Department" 
                value={staffMember.department} 
              />
              <DetailItem 
                icon={Briefcase} 
                label="Position" 
                value={staffMember.position} 
              />
              <DetailItem 
                icon={Phone} 
                label="Phone" 
                value={staffMember.phone} 
              />
              <DetailItem 
                icon={Mail} 
                label="Email" 
                value={staffMember.email || 'Not set'} 
              />
              <DetailItem 
                icon={Calendar} 
                label="Joined" 
                value={format(new Date(staffMember.join_date), 'MMM d, yyyy')} 
              />
              <DetailItem 
                icon={Clock} 
                label="Shift" 
                value={`${staffMember.shift_start?.slice(0, 5) || '09:00'} - ${staffMember.shift_end?.slice(0, 5) || '17:00'}`} 
              />
              {staffMember.date_of_birth && (
                <DetailItem 
                  icon={Cake} 
                  label="Date of Birth" 
                  value={format(new Date(staffMember.date_of_birth), 'MMM d, yyyy')} 
                />
              )}
              {staffMember.address && (
                <DetailItem 
                  icon={Home} 
                  label="Address" 
                  value={staffMember.address} 
                />
              )}
            </div>
          </div>
        </div>

        {/* Live Location Card */}
        {staffMember.track_location && (
          <div className="bg-card rounded-2xl border shadow-lg overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Navigation className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold">Live Location</span>
              </div>
              {latestLocation && (
                <Badge variant="outline" className="text-xs">
                  {locationAge !== null && locationAge < 1 
                    ? 'Just now' 
                    : `${locationAge} min ago`}
                </Badge>
              )}
            </div>
            
            {latestLocation ? (
              <div className="aspect-video relative">
                <iframe
                  src={`https://www.google.com/maps?q=${latestLocation.latitude},${latestLocation.longitude}&z=15&output=embed`}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="absolute bottom-3 left-3 right-3 bg-card/95 backdrop-blur rounded-lg p-2.5 shadow-lg">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        {latestLocation.latitude.toFixed(6)}, {latestLocation.longitude.toFixed(6)}
                      </span>
                    </div>
                    {latestLocation.accuracy && (
                      <span className="text-xs text-muted-foreground">
                        ±{Math.round(latestLocation.accuracy)}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No location data available</p>
                <p className="text-xs mt-1">Location will appear when staff checks in</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Verified at {format(new Date(), 'PPpp')}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/50">
      <div className="p-1.5 rounded-lg bg-background">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}