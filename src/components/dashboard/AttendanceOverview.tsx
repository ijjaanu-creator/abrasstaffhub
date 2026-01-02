import { mockAttendance, mockStaff } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const statusConfig = {
  present: { icon: CheckCircle2, label: 'Present', className: 'text-success bg-success/10' },
  absent: { icon: XCircle, label: 'Absent', className: 'text-destructive bg-destructive/10' },
  late: { icon: AlertCircle, label: 'Late', className: 'text-warning bg-warning/10' },
  early_leave: { icon: Clock, label: 'Early Leave', className: 'text-info bg-info/10' },
  half_day: { icon: Clock, label: 'Half Day', className: 'text-muted-foreground bg-muted' },
};

export function AttendanceOverview() {
  const todayAttendance = mockAttendance.map((record) => {
    const staff = mockStaff.find((s) => s.id === record.staffId);
    return { ...record, staff };
  });

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
        {todayAttendance.map((record, index) => {
          const config = statusConfig[record.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={record.id}
              className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-all duration-200 hover:bg-muted animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-sm font-semibold text-primary">
                    {record.staff?.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{record.staff?.name}</p>
                  <p className="text-sm text-muted-foreground">{record.staff?.position}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {record.checkIn || '--:--'} - {record.checkOut || '--:--'}
                  </p>
                  {record.workHours !== undefined && record.workHours > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {record.workHours.toFixed(1)} hours
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
        })}
      </div>
    </div>
  );
}
