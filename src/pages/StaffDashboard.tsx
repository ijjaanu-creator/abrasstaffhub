import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Clock,
  Wallet,
  Calendar,
  CheckCircle2,
  TrendingUp,
  CalendarDays,
  PartyPopper,
} from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  // Fetch staff member data
  const { data: staffMember } = useQuery({
    queryKey: ['myStaffRecord', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
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

  // Fetch upcoming holidays
  const { data: upcomingHolidays = [] } = useQuery({
    queryKey: ['upcoming-holidays'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('holidays')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
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
        {/* Salary Overview */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-200">
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

          {latestPayroll ? (
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
          ) : (
            <p className="text-center text-muted-foreground py-8">No payroll records yet</p>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-300">
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
                  <th className="py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    In
                  </th>
                  <th className="py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Out
                  </th>
                  <th className="py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Hours
                  </th>
                  <th className="py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
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
                              : record.status === 'holiday'
                              ? 'bg-primary/10 text-primary'
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

        {/* Upcoming Holidays */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-400 lg:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Upcoming Holidays
              </h3>
              <p className="text-sm text-muted-foreground">Sundays + scheduled holidays (no salary deduction)</p>
            </div>
          </div>

          {upcomingHolidays.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No upcoming holidays scheduled</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingHolidays.map((holiday: any) => {
                const holidayDate = new Date(holiday.date + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((holidayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div
                    key={holiday.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <PartyPopper className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {holidayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {diffDays === 0 ? ' • Today' : diffDays === 1 ? ' • Tomorrow' : ` • in ${diffDays} days`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
