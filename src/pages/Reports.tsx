// Reports page with category details and staff attendance history
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV, formatAttendanceForExport, formatPayrollForExport } from '@/lib/exportUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Calendar,
  Users,
  IndianRupee,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  BarChart3,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { StaffAttendanceHistory } from '@/components/reports/StaffAttendanceHistory';

const COLORS = ['hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(217, 91%, 60%)'];

type CategoryType = 'present' | 'absent' | 'late' | 'overtime' | 'lossTime' | null;

interface SelectedStaff {
  id: string;
  name: string;
  position: string;
  department: string;
  employeeId: string;
}

interface CategoryDetailDialogProps {
  category: CategoryType;
  onClose: () => void;
  attendanceData: any[];
  selectedMonth: string;
  expectedHoursPerDay: number;
  onSelectStaff: (staff: SelectedStaff) => void;
}

function CategoryDetailDialog({ 
  category, 
  onClose, 
  attendanceData, 
  selectedMonth,
  expectedHoursPerDay,
  onSelectStaff,
}: CategoryDetailDialogProps) {
  if (!category) return null;

  const getCategoryTitle = () => {
    switch (category) {
      case 'present': return 'Present Staff';
      case 'absent': return 'Absent Staff';
      case 'late': return 'Late Arrivals';
      case 'overtime': return 'Overtime Details';
      case 'lossTime': return 'Loss Time Details';
      default: return '';
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'present': return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'absent': return <XCircle className="h-5 w-5 text-destructive" />;
      case 'late': return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'overtime': return <TrendingUp className="h-5 w-5 text-success" />;
      case 'lossTime': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return null;
    }
  };

  const getFilteredData = () => {
    switch (category) {
      case 'present':
        return attendanceData.filter((a: any) => a.status === 'present');
      case 'absent':
        return attendanceData.filter((a: any) => a.status === 'absent');
      case 'late':
        return attendanceData.filter((a: any) => a.status === 'late');
      case 'overtime':
        return attendanceData.filter((a: any) => Number(a.overtime || 0) > 0);
      case 'lossTime':
        // Staff who worked less than expected hours
        return attendanceData.filter((a: any) => {
          const hoursWorked = Number(a.work_hours || 0);
          return hoursWorked < expectedHoursPerDay && a.status !== 'absent';
        });
      default:
        return [];
    }
  };

  const filteredData = getFilteredData();

  // Group by staff member for summary
  const staffSummary = new Map<string, { 
    id: string;
    name: string; 
    position: string; 
    department: string;
    employeeId: string;
    count: number; 
    totalHours: number;
    totalOvertime: number;
    dates: string[];
  }>();

  filteredData.forEach((record: any) => {
    const staffId = record.staff_members?.id || record.staff_id;
    const existing = staffSummary.get(staffId);
    
    if (existing) {
      existing.count++;
      existing.totalHours += Number(record.work_hours || 0);
      existing.totalOvertime += Number(record.overtime || 0);
      existing.dates.push(record.date);
    } else {
      staffSummary.set(staffId, {
        id: staffId,
        name: record.staff_members?.name || 'Unknown',
        position: record.staff_members?.position || '',
        department: record.staff_members?.department || '',
        employeeId: record.staff_members?.employee_id || '',
        count: 1,
        totalHours: Number(record.work_hours || 0),
        totalOvertime: Number(record.overtime || 0),
        dates: [record.date],
      });
    }
  });

  const summaryArray = Array.from(staffSummary.values()).sort((a, b) => {
    if (category === 'overtime') return b.totalOvertime - a.totalOvertime;
    if (category === 'lossTime') return a.totalHours - b.totalHours;
    return b.count - a.count;
  });

  return (
    <Dialog open={!!category} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getCategoryIcon()}
            {getCategoryTitle()} - {new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh]">
          {summaryArray.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No records found for this category
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">
                    {category === 'overtime' ? 'Overtime Hours' : category === 'lossTime' ? 'Hours Worked' : 'Days'}
                  </TableHead>
                  {(category === 'overtime' || category === 'lossTime') && (
                    <TableHead className="text-center">Records</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryArray.map((staff, index) => (
                  <TableRow 
                    key={index} 
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => {
                      onSelectStaff({
                        id: staff.id,
                        name: staff.name,
                        position: staff.position,
                        department: staff.department,
                        employeeId: staff.employeeId,
                      });
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{staff.name}</p>
                          <p className="text-xs text-muted-foreground">{staff.employeeId} • {staff.position}</p>
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground ml-auto" />
                      </div>
                    </TableCell>
                    <TableCell>{staff.department}</TableCell>
                    <TableCell className="text-center font-semibold">
                      {category === 'overtime' ? (
                        <span className="text-success">{staff.totalOvertime.toFixed(1)}h</span>
                      ) : category === 'lossTime' ? (
                        <span className="text-destructive">{staff.totalHours.toFixed(1)}h</span>
                      ) : (
                        staff.count
                      )}
                    </TableCell>
                    {(category === 'overtime' || category === 'lossTime') && (
                      <TableCell className="text-center text-muted-foreground">
                        {staff.count} day{staff.count > 1 ? 's' : ''}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(null);
  const [selectedStaff, setSelectedStaff] = useState<SelectedStaff | null>(null);
  const { toast } = useToast();

  // Fetch attendance for the selected month
  const { data: attendanceData = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-report', selectedMonth],
    queryFn: async () => {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(selectedMonth);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          staff_members (id, name, position, employee_id, department)
        `)
        .gte('date', startDate)
        .lte('date', endDateStr)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payroll for the selected month
  const { data: payrollData = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['payroll-report', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const monthName = new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long' });

      const { data, error } = await supabase
        .from('payroll_records')
        .select(`
          *,
          staff_members (id, name, position, employee_id)
        `)
        .eq('year', parseInt(year))
        .eq('month', monthName)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch staff count
  const { data: staffCount = 0 } = useQuery({
    queryKey: ['staff-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('staff_members')
        .select('id', { count: 'exact' })
        .eq('status', 'active');
      if (error) throw error;
      return count || 0;
    },
  });

  // Calculate expected working days in the month
  const getDaysInMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const getWorkingDays = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0) { // Exclude Sundays
        workingDays++;
      }
    }
    return workingDays;
  };

  const workingDaysInMonth = getWorkingDays(selectedMonth);
  const expectedHoursPerDay = 8; // Standard 8 hours
  const expectedTotalHours = workingDaysInMonth * expectedHoursPerDay * staffCount;

  // Calculate attendance stats
  const attendanceStats = {
    total: attendanceData.length,
    present: attendanceData.filter((a: any) => a.status === 'present').length,
    absent: attendanceData.filter((a: any) => a.status === 'absent').length,
    late: attendanceData.filter((a: any) => a.status === 'late').length,
    holiday: attendanceData.filter((a: any) => a.status === 'holiday').length,
    totalHours: attendanceData.reduce((sum: number, a: any) => sum + Number(a.work_hours || 0), 0),
    totalOvertime: attendanceData.reduce((sum: number, a: any) => sum + Number(a.overtime || 0), 0),
  };

  // Calculate loss time (expected hours - actual hours worked, excluding overtime)
  const actualRegularHours = attendanceStats.totalHours - attendanceStats.totalOvertime;
  const lossTime = Math.max(0, expectedTotalHours - actualRegularHours);

  // Calculate payroll stats
  const payrollStats = {
    totalPayroll: payrollData.reduce((sum: number, p: any) => sum + Number(p.net_salary || 0), 0),
    pending: payrollData.filter((p: any) => p.status === 'pending').length,
    processed: payrollData.filter((p: any) => p.status === 'processed').length,
    paid: payrollData.filter((p: any) => p.status === 'paid').length,
  };

  // Attendance pie chart data
  const attendancePieData = [
    { name: 'Present', value: attendanceStats.present },
    { name: 'Absent', value: attendanceStats.absent },
    { name: 'Late', value: attendanceStats.late },
    { name: 'Holiday', value: attendanceStats.holiday },
  ].filter(item => item.value > 0);

  // Payroll pie chart data
  const payrollPieData = [
    { name: 'Pending', value: payrollStats.pending },
    { name: 'Processed', value: payrollStats.processed },
    { name: 'Paid', value: payrollStats.paid },
  ].filter(item => item.value > 0);

  // Calculate daily attendance chart data
  const dailyAttendanceMap = new Map<string, { present: number; absent: number; late: number }>();
  attendanceData.forEach((record: any) => {
    const date = record.date;
    if (!dailyAttendanceMap.has(date)) {
      dailyAttendanceMap.set(date, { present: 0, absent: 0, late: 0 });
    }
    const stats = dailyAttendanceMap.get(date)!;
    if (record.status === 'present') stats.present++;
    else if (record.status === 'absent') stats.absent++;
    else if (record.status === 'late') stats.late++;
  });

  const dailyChartData = Array.from(dailyAttendanceMap.entries())
    .map(([date, stats]) => ({
      date: new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
      ...stats,
    }))
    .slice(0, 15)
    .reverse();

  const isLoading = loadingAttendance || loadingPayroll;

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
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View attendance and payroll analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-12 rounded-lg border border-border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-in delay-100">
        <div className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Staff</p>
              <p className="text-2xl font-bold font-display text-foreground">{staffCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attendance Rate</p>
              <p className="text-2xl font-bold font-display text-foreground">
                {attendanceStats.total > 0
                  ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
              <Clock className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold font-display text-foreground">
                {attendanceStats.totalHours.toFixed(0)}h
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-elegant">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
              <IndianRupee className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payroll</p>
              <p className="text-2xl font-bold font-display text-foreground">
                ₹{(payrollStats.totalPayroll / 1000).toFixed(0)}K
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Chart */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">Daily Attendance</h3>
            </div>
          </div>
          {dailyChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="present" fill="hsl(142, 76%, 36%)" name="Present" />
                  <Bar dataKey="late" fill="hsl(38, 92%, 50%)" name="Late" />
                  <Bar dataKey="absent" fill="hsl(0, 84%, 60%)" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No attendance data for this period
            </div>
          )}
        </div>

        {/* Attendance Breakdown */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">Attendance Breakdown</h3>
            </div>
          </div>
          {attendancePieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendancePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {attendancePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No attendance data for this period
            </div>
          )}
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Stats */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-400">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-semibold text-foreground">Attendance Summary</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (attendanceData.length === 0) {
                  toast({ title: 'No data to export', variant: 'destructive' });
                  return;
                }
                const data = formatAttendanceForExport(attendanceData);
                exportToCSV(data, `attendance_${selectedMonth}`);
                toast({ title: 'Attendance report exported!' });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setSelectedCategory('present')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-foreground">Present Days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{attendanceStats.present}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
            <button
              onClick={() => setSelectedCategory('absent')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-foreground">Absent Days</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{attendanceStats.absent}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
            <button
              onClick={() => setSelectedCategory('late')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-warning" />
                <span className="text-foreground">Late Arrivals</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{attendanceStats.late}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-foreground">Working Days (Month)</span>
              </div>
              <span className="font-semibold text-foreground">{workingDaysInMonth}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-info" />
                <span className="text-foreground">Total Hours Worked</span>
              </div>
              <span className="font-semibold text-foreground">{attendanceStats.totalHours.toFixed(1)}h</span>
            </div>
            <button
              onClick={() => setSelectedCategory('overtime')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20 hover:bg-success/20 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-foreground font-medium">Total Overtime</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-success">{attendanceStats.totalOvertime.toFixed(1)}h</span>
                <ChevronRight className="h-4 w-4 text-success/70 group-hover:text-success transition-colors" />
              </div>
            </button>
            <button
              onClick={() => setSelectedCategory('lossTime')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-foreground font-medium">Loss Time</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-destructive">{lossTime.toFixed(1)}h</span>
                <ChevronRight className="h-4 w-4 text-destructive/70 group-hover:text-destructive transition-colors" />
              </div>
            </button>
          </div>

          {/* Category Detail Dialog */}
          <CategoryDetailDialog
            category={selectedCategory}
            onClose={() => setSelectedCategory(null)}
            attendanceData={attendanceData}
            selectedMonth={selectedMonth}
            expectedHoursPerDay={expectedHoursPerDay}
            onSelectStaff={(staff) => {
              setSelectedStaff(staff);
            }}
          />

          {/* Staff Attendance History Dialog */}
          {selectedStaff && (
            <StaffAttendanceHistory
              open={!!selectedStaff}
              onClose={() => setSelectedStaff(null)}
              staffId={selectedStaff.id}
              staffName={selectedStaff.name}
              staffPosition={selectedStaff.position}
              staffDepartment={selectedStaff.department}
              staffEmployeeId={selectedStaff.employeeId}
              attendanceRecords={attendanceData}
              expectedHoursPerDay={expectedHoursPerDay}
            />
          )}
        </div>

        {/* Payroll Stats */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg font-semibold text-foreground">Payroll Summary</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (payrollData.length === 0) {
                  toast({ title: 'No data to export', variant: 'destructive' });
                  return;
                }
                const data = formatPayrollForExport(payrollData);
                exportToCSV(data, `payroll_${selectedMonth}`);
                toast({ title: 'Payroll report exported!' });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <IndianRupee className="h-5 w-5 text-primary" />
                <span className="text-foreground">Total Payroll</span>
              </div>
              <span className="font-semibold text-foreground">₹{payrollStats.totalPayroll.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-warning" />
                <span className="text-foreground">Pending</span>
              </div>
              <span className="font-semibold text-foreground">{payrollStats.pending}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-info" />
                <span className="text-foreground">Processed</span>
              </div>
              <span className="font-semibold text-foreground">{payrollStats.processed}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-foreground">Paid</span>
              </div>
              <span className="font-semibold text-foreground">{payrollStats.paid}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
