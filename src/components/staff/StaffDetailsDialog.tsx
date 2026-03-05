import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from 'date-fns';
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  IndianRupee,
  Loader2,
  User,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StaffDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: {
    id: string;
    name: string;
    position: string;
    department: string;
    salary: number;
    shift_start?: string;
    shift_end?: string;
  } | null;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const statusConfig = {
  present: { icon: CheckCircle, label: 'Present', className: 'bg-success/10 text-success' },
  absent: { icon: XCircle, label: 'Absent', className: 'bg-destructive/10 text-destructive' },
  late: { icon: AlertCircle, label: 'Late', className: 'bg-warning/10 text-warning' },
  holiday: { icon: CalendarDays, label: 'Holiday', className: 'bg-primary/10 text-primary' },
};

export function StaffDetailsDialog({ open, onOpenChange, staff }: StaffDetailsDialogProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth, 1));
  const monthEnd = endOfMonth(monthStart);

  // Fetch attendance records for the selected month
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['staff-attendance-details', staff?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!staff?.id) return [];
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_id', staff.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!staff?.id && open,
  });

  // Fetch payroll records for the selected month
  const { data: payrollRecord } = useQuery({
    queryKey: ['staff-payroll-details', staff?.id, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!staff?.id) return null;
      const monthName = months[selectedMonth];
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('month', monthName)
        .eq('year', selectedYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!staff?.id && open,
  });

  // Fetch app settings for overtime toggle & rate (must be before any early return to respect Rules of Hooks)
  const { data: appSettingsData } = useQuery({
    queryKey: ['appSettings-overtime'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('overtime_rate, enable_overtime')
        .limit(1)
        .maybeSingle();
      return data as { overtime_rate: number | null; enable_overtime: boolean | null } | null;
    },
  });

  if (!staff) return null;

  // Calculate shift duration in hours
  const getShiftDuration = () => {
    const start = staff.shift_start || '09:00';
    const end = staff.shift_end || '17:00';
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    return (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
  };

  const expectedHoursPerDay = getShiftDuration();

  // Calculate attendance stats
  const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
  const absentDays = attendanceRecords.filter(r => r.status === 'absent').length;
  const lateDays = attendanceRecords.filter(r => r.status === 'late').length;
  const holidayDays = attendanceRecords.filter(r => r.status === 'holiday').length;

  // Calculate total work hours and overtime
  let totalWorkHours = 0;
  let totalOvertimeHours = 0;
  let totalLossHours = 0;

  attendanceRecords.forEach(record => {
    if (record.check_in && record.check_out) {
      const [inHour, inMin] = record.check_in.split(':').map(Number);
      const [outHour, outMin] = record.check_out.split(':').map(Number);
      const workedMinutes = (outHour * 60 + outMin) - (inHour * 60 + inMin);
      const workedHours = workedMinutes / 60;
      totalWorkHours += workedHours;

      if (workedHours > expectedHoursPerDay) {
        totalOvertimeHours += workedHours - expectedHoursPerDay;
      } else if (workedHours < expectedHoursPerDay) {
        totalLossHours += expectedHoursPerDay - workedHours;
      }
    }
  });

  // Calculate payment - dynamic working days (total days minus Sundays)
  const daysInMonth = endOfMonth(monthStart).getDate();
  let sundaysInMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(selectedYear, selectedMonth, d).getDay() === 0) sundaysInMonth++;
  }
  const workingDaysInMonth = daysInMonth - sundaysInMonth;
  const dailyRate = staff.salary / workingDaysInMonth;
  const hourlyRate = dailyRate / expectedHoursPerDay;

  const enableOvertime = appSettingsData?.enable_overtime ?? true;
  const overtimeMultiplier = appSettingsData?.overtime_rate ?? 1.5;
  const overtimeRate = enableOvertime ? hourlyRate * overtimeMultiplier : 0;

  const basePay = (presentDays + lateDays) * dailyRate;
  const overtimePay = enableOvertime ? totalOvertimeHours * overtimeRate : 0;
  const lateDeduction = lateDays * (dailyRate * 0.1); // 10% deduction per late day
  const absentDeduction = absentDays * dailyRate;
  const lossTimeDeduction = totalLossHours * hourlyRate;

  const grossPay = basePay + overtimePay;
  const totalDeductions = lateDeduction + lossTimeDeduction;
  const netPayable = grossPay - totalDeductions;

  const years = [currentDate.getFullYear(), currentDate.getFullYear() - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground font-bold">
              {staff.name.charAt(0)}
            </div>
            <div>
              <div className="text-lg">{staff.name}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {staff.position} • {staff.department}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Month/Year Selector */}
        <div className="flex gap-3 border-b pb-4">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={month} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="attendance" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance">
              <CalendarDays className="h-4 w-4 mr-2" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="payment">
              <IndianRupee className="h-4 w-4 mr-2" />
              Payment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="flex-1 overflow-hidden mt-4">
            {attendanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-success">{presentDays}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-destructive">{absentDays}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-warning">{lateDays}</div>
                    <div className="text-xs text-muted-foreground">Late</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{holidayDays}</div>
                    <div className="text-xs text-muted-foreground">Holiday</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{totalOvertimeHours.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground">Overtime</div>
                  </div>
                </div>

                {/* Attendance List */}
                <ScrollArea className="h-[280px]">
                  {attendanceRecords.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No attendance records for this month
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attendanceRecords.map((record) => {
                        const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.absent;
                        const StatusIcon = config.icon;
                        
                        let workHours = 0;
                        if (record.check_in && record.check_out) {
                          const [inH, inM] = record.check_in.split(':').map(Number);
                          const [outH, outM] = record.check_out.split(':').map(Number);
                          workHours = ((outH * 60 + outM) - (inH * 60 + inM)) / 60;
                        }

                        return (
                          <div
                            key={record.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium min-w-[80px]">
                                {format(parseISO(record.date), 'dd MMM')}
                              </div>
                              <Badge className={config.className} variant="secondary">
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {record.check_in && (
                                <span>In: {record.check_in?.slice(0, 5)}</span>
                              )}
                              {record.check_out && (
                                <span>Out: {record.check_out?.slice(0, 5)}</span>
                              )}
                              {workHours > 0 && (
                                <span className="font-medium text-foreground">
                                  {workHours.toFixed(1)}h
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payment" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[380px]">
              <div className="space-y-6">
                {/* Already Paid Info */}
                {payrollRecord && (
                  <div className={`rounded-lg p-4 ${
                    payrollRecord.status === 'paid' 
                      ? 'bg-success/10 border border-success/20' 
                      : payrollRecord.status === 'processed'
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-warning/10 border border-warning/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {payrollRecord.status === 'paid' ? 'Salary Paid' : 
                           payrollRecord.status === 'processed' ? 'Salary Processed' : 'Salary Pending'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payrollRecord.payment_date && `Paid on ${format(parseISO(payrollRecord.payment_date), 'dd MMM yyyy')}`}
                        </div>
                      </div>
                      <div className="text-xl font-bold">
                        ₹{Number(payrollRecord.net_salary).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculation Breakdown */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Payment Calculation
                  </h4>

                  <div className="rounded-lg border divide-y">
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Base Salary</span>
                      <span>₹{staff.salary.toLocaleString()}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Daily Rate ({workingDaysInMonth} days)</span>
                      <span>₹{dailyRate.toFixed(0)}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-muted-foreground">Hourly Rate</span>
                      <span>₹{hourlyRate.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="rounded-lg border">
                    <div className="p-3 bg-muted/30 font-medium">Earnings</div>
                    <div className="divide-y">
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">
                          Days Worked ({presentDays + lateDays} days)
                        </span>
                        <span className="text-success">+₹{basePay.toFixed(0)}</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">
                          Overtime ({totalOvertimeHours.toFixed(1)} hrs @ 1.5x)
                        </span>
                        <span className="text-success">+₹{overtimePay.toFixed(0)}</span>
                      </div>
                      <div className="p-3 flex justify-between font-medium">
                        <span>Gross Pay</span>
                        <span className="text-success">₹{grossPay.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="rounded-lg border">
                    <div className="p-3 bg-muted/30 font-medium">Deductions</div>
                    <div className="divide-y">
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">
                          Late Penalty ({lateDays} days @ 10%)
                        </span>
                        <span className="text-destructive">-₹{lateDeduction.toFixed(0)}</span>
                      </div>
                      <div className="p-3 flex justify-between">
                        <span className="text-muted-foreground">
                          Loss Time ({totalLossHours.toFixed(1)} hrs)
                        </span>
                        <span className="text-destructive">-₹{lossTimeDeduction.toFixed(0)}</span>
                      </div>
                      <div className="p-3 flex justify-between font-medium">
                        <span>Total Deductions</span>
                        <span className="text-destructive">-₹{totalDeductions.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Payable */}
                  <div className="rounded-lg border border-primary bg-primary/5 p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-lg">Net Payable</div>
                        <div className="text-sm text-muted-foreground">
                          For {months[selectedMonth]} {selectedYear}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        ₹{netPayable.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
