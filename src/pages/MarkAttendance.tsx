import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/use-biometric-auth';
import { Fingerprint, Clock, CheckCircle, Loader2, ScanFace } from 'lucide-react';
import { format } from 'date-fns';

export default function MarkAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { verify, isAuthenticating, enroll, isEnrolling } = useBiometricAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: staffMember, isLoading: staffLoading } = useQuery({
    queryKey: ['my-staff-record', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['my-attendance-today', staffMember?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_id', staffMember?.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id,
  });

  // Handle biometric enrollment
  const handleEnroll = async () => {
    if (!staffMember) return;
    await enroll(staffMember.id, staffMember.name);
    queryClient.invalidateQueries({ queryKey: ['my-staff-record'] });
  };

  // Handle biometric check-in
  const handleCheckIn = async () => {
    if (!staffMember?.biometric_credential_id) {
      toast({
        title: 'Biometric not enrolled',
        description: 'Please enroll your fingerprint or face first.',
        variant: 'destructive',
      });
      return;
    }
    const verified = await verify(staffMember.biometric_credential_id);
    if (verified) {
      checkInMutation.mutate();
    }
  };

  // Handle biometric check-out
  const handleCheckOut = async () => {
    if (!staffMember?.biometric_credential_id) {
      toast({
        title: 'Biometric not enrolled',
        description: 'Please enroll your fingerprint or face first.',
        variant: 'destructive',
      });
      return;
    }
    const verified = await verify(staffMember.biometric_credential_id);
    if (verified) {
      checkOutMutation.mutate();
    }
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const checkInTime = format(now, 'HH:mm');
      const isLate = now.getHours() >= 9;
      
      const { error } = await supabase.from('attendance_records').insert({
        staff_id: staffMember?.id,
        date: today,
        check_in: checkInTime,
        status: isLate ? 'late' : 'present',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      toast({ title: 'Checked in successfully!' });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const checkOutTime = format(new Date(), 'HH:mm');
      const { error } = await supabase
        .from('attendance_records')
        .update({ check_out: checkOutTime })
        .eq('id', todayAttendance?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-today'] });
      toast({ title: 'Checked out successfully!' });
    },
  });

  if (staffLoading || isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!staffMember) {
    return (
      <div className="text-center py-12">
        <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
        <p className="text-muted-foreground mt-2">Your account is not linked to a staff record.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="rounded-xl border bg-card p-6 text-center space-y-6">
        <div className="flex h-24 w-24 mx-auto items-center justify-center rounded-full gradient-primary">
          <Fingerprint className="h-12 w-12 text-primary-foreground" />
        </div>

        {/* Show enrollment if not enrolled */}
        {!staffMember?.biometric_credential_id ? (
          <div className="space-y-4">
            <div className="bg-warning/10 text-warning rounded-lg p-3 text-sm text-center">
              You need to enroll your biometric first
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={isEnrolling}
              onClick={handleEnroll}
            >
              {isEnrolling ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ScanFace className="h-5 w-5 mr-2" />
              )}
              Enroll Fingerprint / Face
            </Button>
          </div>
        ) : !todayAttendance ? (
          <Button size="lg" className="w-full" onClick={handleCheckIn} disabled={checkInMutation.isPending || isAuthenticating}>
            {checkInMutation.isPending || isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ScanFace className="h-5 w-5 mr-2" />}
            Verify & Check In
          </Button>
        ) : !todayAttendance.check_out ? (
          <>
            <div className="text-success flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" /> Checked in at {todayAttendance.check_in}
            </div>
            <Button size="lg" variant="outline" className="w-full" onClick={handleCheckOut} disabled={checkOutMutation.isPending || isAuthenticating}>
              {checkOutMutation.isPending || isAuthenticating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Fingerprint className="h-5 w-5 mr-2" />}
              Verify & Check Out
            </Button>
          </>
        ) : (
          <div className="space-y-2 text-success">
            <CheckCircle className="h-12 w-12 mx-auto" />
            <p className="font-medium">Attendance Completed</p>
            <p className="text-sm text-muted-foreground">In: {todayAttendance.check_in} | Out: {todayAttendance.check_out}</p>
          </div>
        )}
        <p className="text-xs text-center text-muted-foreground mt-4">
          Use your enrolled fingerprint or face to verify
        </p>
      </div>
    </div>
  );
}
