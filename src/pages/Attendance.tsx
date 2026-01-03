import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, formatAttendanceForExport } from '@/lib/exportUtils';
import {
  Search,
  Calendar,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';

const statusConfig: Record<string, { icon: any; label: string; className: string }> = {
  present: { icon: CheckCircle2, label: 'Present', className: 'text-success bg-success/10' },
  absent: { icon: XCircle, label: 'Absent', className: 'text-destructive bg-destructive/10' },
  late: { icon: AlertCircle, label: 'Late', className: 'text-warning bg-warning/10' },
  early_leave: { icon: Clock, label: 'Early Leave', className: 'text-info bg-info/10' },
  half_day: { icon: Clock, label: 'Half Day', className: 'text-muted-foreground bg-muted' },
};

export default function Attendance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { toast } = useToast();

  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ['attendance-records', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          staff_members (
            id,
            name,
            position,
            employee_id,
            department
          )
        `)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredAttendance = attendanceRecords.filter(
    (record: any) =>
      record.staff_members?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.staff_members?.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    present: filteredAttendance.filter((a: any) => a.status === 'present').length,
    absent: filteredAttendance.filter((a: any) => a.status === 'absent').length,
    late: filteredAttendance.filter((a: any) => a.status === 'late').length,
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage staff attendance records
          </p>
        </div>
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full sm:w-auto"
          onClick={() => {
            if (filteredAttendance.length === 0) {
              toast({ title: 'No data to export', variant: 'destructive' });
              return;
            }
            const data = formatAttendanceForExport(filteredAttendance);
            exportToCSV(data, `attendance_${selectedDate}`);
            toast({ title: 'Attendance report exported successfully!' });
          }}
        >
          <Download className="h-5 w-5 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3 animate-fade-in delay-100">
        <div className="flex items-center gap-3 lg:gap-4 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-success" />
          </div>
          <div>
            <p className="text-xs lg:text-sm text-muted-foreground">Present</p>
            <p className="text-xl lg:text-2xl font-bold font-display text-foreground">{stats.present}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 lg:gap-4 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-destructive/10">
            <XCircle className="h-5 w-5 lg:h-6 lg:w-6 text-destructive" />
          </div>
          <div>
            <p className="text-xs lg:text-sm text-muted-foreground">Absent</p>
            <p className="text-xl lg:text-2xl font-bold font-display text-foreground">{stats.absent}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 lg:gap-4 rounded-xl border border-border bg-card p-3 lg:p-4 shadow-elegant">
          <div className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-xl bg-warning/10">
            <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-warning" />
          </div>
          <div>
            <p className="text-xs lg:text-sm text-muted-foreground">Late</p>
            <p className="text-xl lg:text-2xl font-bold font-display text-foreground">{stats.late}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row animate-fade-in delay-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-10 h-12 w-full sm:w-48"
          />
        </div>
      </div>

      {/* Attendance List - Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {filteredAttendance.map((record: any) => {
          const config = statusConfig[record.status] || statusConfig.present;
          const StatusIcon = config.icon;

          return (
            <div
              key={record.id}
              className="rounded-xl border border-border bg-card p-4 shadow-elegant"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold">
                    {record.staff_members?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{record.staff_members?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{record.staff_members?.position}</p>
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    config.className
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Check In</p>
                  <p className="font-medium">{record.check_in || '--:--'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Check Out</p>
                  <p className="font-medium">{record.check_out || '--:--'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Hours</p>
                  <p className="font-medium">{record.work_hours ? `${record.work_hours.toFixed(1)}h` : '-'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attendance Table - Desktop */}
      <div className="hidden lg:block rounded-xl border border-border bg-card shadow-elegant overflow-hidden animate-fade-in delay-300">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Employee</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Position</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Check In</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Check Out</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Work Hours</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Overtime</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.map((record: any) => {
                const config = statusConfig[record.status] || statusConfig.present;
                const StatusIcon = config.icon;

                return (
                  <tr
                    key={record.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold">
                          {record.staff_members?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{record.staff_members?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{record.staff_members?.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.staff_members?.position}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {record.check_in || '--:--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {record.check_out || '--:--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {record.work_hours ? `${record.work_hours.toFixed(1)}h` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {record.overtime ? (
                        <span className="text-success font-medium">+{record.overtime.toFixed(1)}h</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                          config.className
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {config.label}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAttendance.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No attendance records found for this date.</p>
        </div>
      )}
    </div>
  );
}
