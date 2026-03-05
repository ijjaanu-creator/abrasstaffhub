import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Calendar,
  User,
} from 'lucide-react';

interface StaffAttendanceHistoryProps {
  open: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  staffPosition: string;
  staffDepartment: string;
  staffEmployeeId: string;
  attendanceRecords: any[];
  expectedHoursPerDay: number;
}

interface DayRecord {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workHours: number;
  overtime: number;
  lossTime: number;
}

export function StaffAttendanceHistory({
  open,
  onClose,
  staffId,
  staffName,
  staffPosition,
  staffDepartment,
  staffEmployeeId,
  attendanceRecords,
  expectedHoursPerDay,
}: StaffAttendanceHistoryProps) {
  const [activeTab, setActiveTab] = useState('all');

  // Filter records for this staff member
  const staffRecords = attendanceRecords.filter(
    (r: any) => (r.staff_members?.id || r.staff_id) === staffId
  );

  // Process records into categorized lists
  const processedRecords: DayRecord[] = staffRecords.map((r: any) => {
    const workHours = Number(r.work_hours || 0);
    const overtime = Number(r.overtime || 0);
    const regularHours = workHours - overtime;
    const lossTime = r.status !== 'absent' ? Math.max(0, expectedHoursPerDay - regularHours) : 0;

    return {
      date: r.date,
      status: r.status,
      checkIn: r.check_in,
      checkOut: r.check_out,
      workHours,
      overtime,
      lossTime,
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const presentDays = processedRecords.filter(r => r.status === 'present');
  const absentDays = processedRecords.filter(r => r.status === 'absent');
  const lateDays = processedRecords.filter(r => r.status === 'late');
  const holidayDays = processedRecords.filter(r => r.status === 'holiday');
  const overtimeDays = processedRecords.filter(r => r.overtime > 0);
  const lossTimeDays = processedRecords.filter(r => r.lossTime > 0);

  // Summary stats
  const stats = {
    totalDays: processedRecords.length,
    presentCount: presentDays.length,
    absentCount: absentDays.length,
    lateCount: lateDays.length,
    totalHours: processedRecords.reduce((sum, r) => sum + r.workHours, 0),
    totalOvertime: processedRecords.reduce((sum, r) => sum + r.overtime, 0),
    totalLossTime: processedRecords.reduce((sum, r) => sum + r.lossTime, 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success/10 text-success border-success/20">Present</Badge>;
      case 'absent':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Absent</Badge>;
      case 'late':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Late</Badge>;
      case 'holiday':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Holiday</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.slice(0, 5); // HH:MM format
  };

  const renderDaysList = (records: DayRecord[], showOvertime = false, showLossTime = false) => {
    if (records.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No records found
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {records.map((record, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">
                  {format(parseISO(record.date), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(record.checkIn)} - {formatTime(record.checkOut)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {showOvertime && record.overtime > 0 && (
                <span className="text-sm font-semibold text-success">
                  +{record.overtime.toFixed(1)}h OT
                </span>
              )}
              {showLossTime && record.lossTime > 0 && (
                <span className="text-sm font-semibold text-destructive">
                  -{record.lossTime.toFixed(1)}h
                </span>
              )}
              {!showOvertime && !showLossTime && (
                <span className="text-sm text-muted-foreground">
                  {record.workHours.toFixed(1)}h
                </span>
              )}
              {getStatusBadge(record.status)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const tabs = [
    { id: 'all', label: 'All', icon: Calendar, count: stats.totalDays },
    { id: 'present', label: 'Present', icon: CheckCircle2, count: stats.presentCount, color: 'text-success' },
    { id: 'absent', label: 'Absent', icon: XCircle, count: stats.absentCount, color: 'text-destructive' },
    { id: 'late', label: 'Late', icon: AlertCircle, count: stats.lateCount, color: 'text-warning' },
    { id: 'holiday', label: 'Holiday', icon: Calendar, count: holidayDays.length, color: 'text-primary' },
    { id: 'overtime', label: 'Overtime', icon: TrendingUp, count: overtimeDays.length, color: 'text-success' },
    { id: 'losstime', label: 'Loss Time', icon: Clock, count: lossTimeDays.length, color: 'text-destructive' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{staffName}</h3>
              <p className="text-sm font-normal text-muted-foreground">
                {staffEmployeeId} • {staffPosition} • {staffDepartment}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="rounded-lg bg-success/10 p-3 text-center">
            <p className="text-2xl font-bold text-success">{stats.presentCount}</p>
            <p className="text-xs text-muted-foreground">Present Days</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.absentCount}</p>
            <p className="text-xs text-muted-foreground">Absent Days</p>
          </div>
          <div className="rounded-lg bg-warning/10 p-3 text-center">
            <p className="text-2xl font-bold text-warning">{stats.lateCount}</p>
            <p className="text-xs text-muted-foreground">Late Days</p>
          </div>
          <div className="rounded-lg bg-info/10 p-3 text-center">
            <p className="text-2xl font-bold text-info">{stats.totalHours.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Hours</p>
          </div>
        </div>

        {/* Hours Summary */}
        <div className="flex items-center justify-center gap-6 py-2 border-y border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm">
              Overtime: <span className="font-semibold text-success">{stats.totalOvertime.toFixed(1)}h</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-destructive" />
            <span className="text-sm">
              Loss Time: <span className="font-semibold text-destructive">{stats.totalLossTime.toFixed(1)}h</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full grid grid-cols-7 h-auto p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex flex-col items-center gap-1 py-2 px-1 text-xs"
              >
                <tab.icon className={`h-4 w-4 ${tab.color || ''}`} />
                <span>{tab.label}</span>
                <span className={`text-xs font-bold ${tab.color || ''}`}>{tab.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="h-[40vh] mt-4">
            <TabsContent value="all" className="mt-0">
              {renderDaysList(processedRecords)}
            </TabsContent>
            <TabsContent value="present" className="mt-0">
              {renderDaysList(presentDays)}
            </TabsContent>
            <TabsContent value="absent" className="mt-0">
              {renderDaysList(absentDays)}
            </TabsContent>
            <TabsContent value="late" className="mt-0">
              {renderDaysList(lateDays)}
            </TabsContent>
            <TabsContent value="holiday" className="mt-0">
              {renderDaysList(holidayDays)}
            </TabsContent>
            <TabsContent value="overtime" className="mt-0">
              {renderDaysList(overtimeDays, true, false)}
            </TabsContent>
            <TabsContent value="losstime" className="mt-0">
              {renderDaysList(lossTimeDays, false, true)}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
