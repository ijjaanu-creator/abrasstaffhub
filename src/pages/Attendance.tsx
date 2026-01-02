import { useState } from 'react';
import { mockAttendance, mockStaff } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  Calendar,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Filter,
} from 'lucide-react';

const statusConfig = {
  present: { icon: CheckCircle2, label: 'Present', className: 'text-success bg-success/10' },
  absent: { icon: XCircle, label: 'Absent', className: 'text-destructive bg-destructive/10' },
  late: { icon: AlertCircle, label: 'Late', className: 'text-warning bg-warning/10' },
  early_leave: { icon: Clock, label: 'Early Leave', className: 'text-info bg-info/10' },
  half_day: { icon: Clock, label: 'Half Day', className: 'text-muted-foreground bg-muted' },
};

export default function Attendance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const attendanceWithStaff = mockAttendance.map((record) => {
    const staff = mockStaff.find((s) => s.id === record.staffId);
    return { ...record, staff };
  });

  const filteredAttendance = attendanceWithStaff.filter(
    (record) =>
      record.staff?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.staff?.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    present: filteredAttendance.filter((a) => a.status === 'present').length,
    absent: filteredAttendance.filter((a) => a.status === 'absent').length,
    late: filteredAttendance.filter((a) => a.status === 'late').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Attendance</h1>
          <p className="mt-1 text-muted-foreground">
            Track and manage staff attendance records
          </p>
        </div>
        <Button variant="outline" size="lg">
          <Download className="h-5 w-5 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 animate-fade-in delay-100">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Present</p>
            <p className="text-2xl font-bold font-display text-foreground">{stats.present}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Absent</p>
            <p className="text-2xl font-bold font-display text-foreground">{stats.absent}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
            <AlertCircle className="h-6 w-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Late</p>
            <p className="text-2xl font-bold font-display text-foreground">{stats.late}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row animate-fade-in delay-200">
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
        <Button variant="outline" size="lg">
          <Filter className="h-5 w-5 mr-2" />
          Filters
        </Button>
      </div>

      {/* Attendance Table */}
      <div className="rounded-xl border border-border bg-card shadow-elegant overflow-hidden animate-fade-in delay-300">
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
              {filteredAttendance.map((record, index) => {
                const config = statusConfig[record.status];
                const StatusIcon = config.icon;

                return (
                  <tr
                    key={record.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold">
                          {record.staff?.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{record.staff?.name}</p>
                          <p className="text-xs text-muted-foreground">{record.staff?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {record.staff?.position}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {record.checkIn || '--:--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {record.checkOut || '--:--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {record.workHours ? `${record.workHours.toFixed(1)}h` : '-'}
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
    </div>
  );
}
