import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Calendar, Clock, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function MyAttendance() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: staffMember } = useQuery({
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

  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ['my-attendance', staffMember?.id, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_id', staffMember?.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!staffMember?.id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-success/10 text-success';
      case 'late': return 'bg-warning/10 text-warning';
      case 'absent': return 'bg-destructive/10 text-destructive';
      case 'holiday': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  if (!staffMember) {
    return (
      <div className="text-center py-12">
        <h1 className="font-display text-2xl font-bold">My Attendance</h1>
        <p className="text-muted-foreground mt-2">Your account is not linked to a staff record.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
  const lateDays = attendanceRecords.filter(r => r.status === 'late').length;
  const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
  const holidayDays = attendanceRecords.filter(r => r.status === 'holiday').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">My Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">View your attendance history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-success">{presentDays}</p>
          <p className="text-sm text-muted-foreground">Present</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-warning">{lateDays}</p>
          <p className="text-sm text-muted-foreground">Late</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{absentDays}</p>
          <p className="text-sm text-muted-foreground">Absent</p>
        </div>
      </div>

      {/* Attendance List */}
      <div className="rounded-xl border bg-card divide-y divide-border">
        {attendanceRecords.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No attendance records for this month
          </div>
        ) : (
          attendanceRecords.map((record) => (
            <div key={record.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{format(new Date(record.date), 'EEEE, MMM d')}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{record.check_in || '--:--'} - {record.check_out || '--:--'}</span>
                  </div>
                </div>
              </div>
              <span className={cn('rounded-full px-2 py-1 text-xs font-medium capitalize', getStatusColor(record.status))}>
                {record.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}