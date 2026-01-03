import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

const statusConfig = {
  present: { icon: CheckCircle2, label: 'Present', className: 'text-success bg-success/10' },
  absent: { icon: XCircle, label: 'Absent', className: 'text-destructive bg-destructive/10' },
  late: { icon: AlertCircle, label: 'Late', className: 'text-warning bg-warning/10' },
  early_leave: { icon: Clock, label: 'Early Leave', className: 'text-info bg-info/10' },
  half_day: { icon: Clock, label: 'Half Day', className: 'text-muted-foreground bg-muted' },
};

const OFFICE_CLOSE_TIME = '18:00'; // Office closing time

function calculateWorkHours(checkIn: string | null, checkOut: string | null): { hours: number; isEstimated: boolean } {
  if (!checkIn) return { hours: 0, isEstimated: false };
  
  const [inHours, inMinutes] = checkIn.split(':').map(Number);
  const checkInMinutes = inHours * 60 + inMinutes;
  
  let checkOutMinutes: number;
  let isEstimated = false;
  
  if (checkOut) {
    const [outHours, outMinutes] = checkOut.split(':').map(Number);
    checkOutMinutes = outHours * 60 + outMinutes;
  } else {
    // Use office closing time if not checked out
    const [closeHours, closeMinutes] = OFFICE_CLOSE_TIME.split(':').map(Number);
    checkOutMinutes = closeHours * 60 + closeMinutes;
    isEstimated = true;
  }
  
  const diffMinutes = checkOutMinutes - checkInMinutes;
  const hours = Math.max(0, diffMinutes / 60);
  
  return { hours, isEstimated };
}

export function AttendanceOverview() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todayAttendance = [], isLoading } = useQuery({
    queryKey: ['todayAttendance', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          staff_members (id, name, position)
        `)
        .eq('date', today)
        .order('check_in', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elegant">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground">Today's Attendance</h3>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>

      <div className="space-y-3">
        {todayAttendance.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No attendance records for today yet
          </div>
        ) : (
          todayAttendance.map((record: any, index: number) => {
            const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.present;
            const StatusIcon = config.icon;
            const { hours, isEstimated } = calculateWorkHours(record.check_in, record.check_out);

            return (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-all duration-200 hover:bg-muted animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-semibold text-primary">
                      {record.staff_members?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{record.staff_members?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{record.staff_members?.position}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {record.check_in || '--:--'} - {record.check_out || OFFICE_CLOSE_TIME}
                    </p>
                    {hours > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {hours.toFixed(1)} hours{isEstimated && ' (until close)'}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                      config.className
                    )}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {config.label}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
