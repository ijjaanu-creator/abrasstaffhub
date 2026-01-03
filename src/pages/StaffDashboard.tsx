import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBiometricAuth } from '@/hooks/use-biometric-auth';
import {
  Clock,
  Wallet,
  Calendar,
  Fingerprint,
  CheckCircle2,
  TrendingUp,
  Loader2,
  ScanFace,
} from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authenticate, isAuthenticating } = useBiometricAuth();
  
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  // Fetch staff member data
  const { data: staffMember } = useQuery({
    queryKey: ['myStaffRecord', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch today's attendance
  const { data: todayAttendance } = useQuery({
    queryKey: ['myTodayAttendance', staffMember?.id],
    queryFn: async () => {
      if (!staffMember?.id) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_id', staffMember.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id,
  });

  // Fetch recent attendance (last 7 days)
  const { data: recentAttendance = [] } = useQuery({
    queryKey: ['myRecentAttendance', staffMember?.id],
    queryFn: async () => {
      if (!staffMember?.id) return [];
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
      
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_id', staffMember.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!staffMember?.id,
  });

  // Fetch latest payroll
  const { data: latestPayroll } = useQuery({
    queryKey: ['myLatestPayroll', staffMember?.id],
    queryFn: async () => {
      if (!staffMember?.id) return null;
      const { data } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('staff_id', staffMember.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!staffMember?.id,
  });

  // Handle biometric check-in
  const handleCheckIn = async () => {
    const verified = await authenticate();
    if (verified) {
      checkInMutation.mutate();
    }
  };

  // Handle biometric check-out
  const handleCheckOut = async () => {
    const verified = await authenticate();
    if (verified) {
      checkOutMutation.mutate();
    }
  };

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!staffMember?.id) throw new Error('Staff member not found');
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().slice(0, 5);
      const isLate = now > '09:00';
      
      const { error } = await supabase
        .from('attendance_records')
        .insert({
          staff_id: staffMember.id,
          date: today,
          check_in: now,
          status: isLate ? 'late' : 'present',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTodayAttendance'] });
      toast({ title: 'Checked in successfully!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Check-in failed', description: error.message, variant: 'destructive' });
    },
  });

  // Check out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayAttendance?.id) throw new Error('No check-in record found');
      const now = new Date().toTimeString().slice(0, 5);
      
      // Calculate work hours
      const checkIn = todayAttendance.check_in;
      const [checkInHours, checkInMinutes] = checkIn.split(':').map(Number);
      const [checkOutHours, checkOutMinutes] = now.split(':').map(Number);
      const workHours = (checkOutHours + checkOutMinutes / 60) - (checkInHours + checkInMinutes / 60);
      const overtime = Math.max(0, workHours - 8);
      
      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out: now,
          work_hours: workHours,
          overtime: overtime,
        })
        .eq('id', todayAttendance.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTodayAttendance'] });
      toast({ title: 'Checked out successfully!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Check-out failed', description: error.message, variant: 'destructive' });
    },
  });

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-foreground">
          Good morning, {displayName.split(' ')[0]}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Status"
          value={todayAttendance?.status === 'present' ? 'Present' : todayAttendance?.status || 'Not marked'}
          icon={CheckCircle2}
          variant={todayAttendance?.status === 'present' ? 'success' : 'warning'}
          className="animate-fade-in"
        />
        <StatsCard
          title="Check In"
          value={todayAttendance?.check_in || '--:--'}
          icon={Clock}
          className="animate-fade-in delay-100"
        />
        <StatsCard
          title="Check Out"
          value={todayAttendance?.check_out || '--:--'}
          icon={Clock}
          className="animate-fade-in delay-200"
        />
        <StatsCard
          title="Work Hours"
          value={todayAttendance?.work_hours ? `${Number(todayAttendance.work_hours).toFixed(1)}h` : '0h'}
          icon={TrendingUp}
          variant="primary"
          className="animate-fade-in delay-300"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mark Attendance Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl gradient-primary">
              <Fingerprint className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Mark Attendance
              </h3>
              <p className="text-sm text-muted-foreground">
                Use biometric to mark your attendance
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="hero"
              size="lg"
              className="w-full"
              disabled={!!todayAttendance?.check_in || checkInMutation.isPending || isAuthenticating}
              onClick={handleCheckIn}
            >
              {checkInMutation.isPending || isAuthenticating ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <ScanFace className="h-5 w-5 mr-2" />
              )}
              {todayAttendance?.check_in ? 'Already Checked In' : 'Verify & Check In'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              disabled={!todayAttendance?.check_in || !!todayAttendance?.check_out || checkOutMutation.isPending || isAuthenticating}
              onClick={handleCheckOut}
            >
              {checkOutMutation.isPending || isAuthenticating ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Fingerprint className="h-5 w-5 mr-2" />
              )}
              {todayAttendance?.check_out ? 'Already Checked Out' : 'Verify & Check Out'}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Use fingerprint or face recognition to verify your identity
            </p>
          </div>
        </div>

        {/* Salary Overview */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-success/10">
                <Wallet className="h-7 w-7 text-success" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Salary Overview
                </h3>
                <p className="text-sm text-muted-foreground">{currentMonth}</p>
              </div>
            </div>
          </div>

          {latestPayroll && (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Base Salary</span>
                <span className="font-medium text-foreground">
                  ₹{Number(latestPayroll.base_salary).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Overtime</span>
                <span className="font-medium text-success">
                  +₹{Number(latestPayroll.overtime).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Deductions</span>
                <span className="font-medium text-destructive">
                  -₹{Number(latestPayroll.deductions).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Bonus</span>
                <span className="font-medium text-success">
                  +₹{Number(latestPayroll.bonus).toLocaleString()}
                </span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Net Salary</span>
                  <span className="text-2xl font-bold font-display text-primary">
                    ₹{Number(latestPayroll.net_salary).toLocaleString()}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium',
                  latestPayroll.status === 'paid'
                    ? 'bg-success/10 text-success'
                    : latestPayroll.status === 'processed'
                    ? 'bg-info/10 text-info'
                    : 'bg-warning/10 text-warning'
                )}
              >
                <span className="capitalize">{latestPayroll.status}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-400">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Recent Attendance
            </h3>
            <p className="text-sm text-muted-foreground">Your attendance history</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Check In</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Check Out</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Hours</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAttendance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No attendance records yet
                  </td>
                </tr>
              ) : (
                recentAttendance.map((record: any) => (
                  <tr key={record.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 text-sm text-foreground">
                      {new Date(record.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 text-sm text-foreground">
                      {record.check_in || '--:--'}
                    </td>
                    <td className="py-3 text-sm text-foreground">
                      {record.check_out || '--:--'}
                    </td>
                    <td className="py-3 text-sm text-foreground">
                      {record.work_hours ? Number(record.work_hours).toFixed(1) : '0'}h
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          record.status === 'present'
                            ? 'bg-success/10 text-success'
                            : record.status === 'late'
                            ? 'bg-warning/10 text-warning'
                            : record.status === 'absent'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {record.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
