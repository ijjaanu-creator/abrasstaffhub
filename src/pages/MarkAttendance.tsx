import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Fingerprint, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function MarkAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: staffMember } = useQuery({
    queryKey: ['my-staff-record', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', user?.id)
        .single();
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

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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

        {!todayAttendance ? (
          <Button size="lg" className="w-full" onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
            {checkInMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Clock className="h-5 w-5 mr-2" />}
            Check In
          </Button>
        ) : !todayAttendance.check_out ? (
          <>
            <div className="text-success flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" /> Checked in at {todayAttendance.check_in}
            </div>
            <Button size="lg" variant="outline" className="w-full" onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending}>
              {checkOutMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Check Out
            </Button>
          </>
        ) : (
          <div className="space-y-2 text-success">
            <CheckCircle className="h-12 w-12 mx-auto" />
            <p className="font-medium">Attendance Completed</p>
            <p className="text-sm text-muted-foreground">In: {todayAttendance.check_in} | Out: {todayAttendance.check_out}</p>
          </div>
        )}
      </div>
    </div>
  );
}
