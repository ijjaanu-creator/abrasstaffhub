import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { recalcNetSalary, getMonthIndex } from '@/lib/payrollCalc';

export default function MySalary() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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

  const { data: payrollRecords = [], isLoading } = useQuery({
    queryKey: ['my-payroll', staffMember?.id, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('staff_id', staffMember?.id)
        .eq('year', selectedYear)
        .order('month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!staffMember?.id,
  });

  // Holidays for the year
  const { data: yearHolidays = [] } = useQuery({
    queryKey: ['year-holidays', selectedYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('holidays')
        .select('date')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Absences for the year for this staff
  const { data: yearAbsences = [] } = useQuery({
    queryKey: ['my-year-absences', staffMember?.id, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('date, status')
        .eq('staff_id', staffMember?.id)
        .eq('status', 'absent')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffMember?.id,
  });

  const holidayDates = new Set<string>(yearHolidays.map((h: any) => h.date));
  const absencesByMonth = new Map<number, number>();
  yearAbsences.forEach((a: any) => {
    const m = new Date(a.date + 'T00:00:00').getMonth();
    absencesByMonth.set(m, (absencesByMonth.get(m) || 0) + 1);
  });

  const enrichedRecords = payrollRecords.map((r: any) => {
    const mi = getMonthIndex(r.month);
    const absentDays = absencesByMonth.get(mi) || 0;
    const { net, absenceDeduction, workingDays } = recalcNetSalary({
      baseSalary: Number(r.base_salary || 0),
      bonus: Number(r.bonus || 0),
      deductions: Number(r.deductions || 0),
      storedNet: Number(r.net_salary || 0),
      year: r.year,
      month: r.month,
      absentDays,
      holidayDates,
    });
    return { ...r, _displayNet: net, _absenceDeduction: absenceDeduction, _absentDays: absentDays, _workingDays: workingDays };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-success/10 text-success';
      case 'pending': return 'bg-warning/10 text-warning';
      case 'processing': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!staffMember) {
    return (
      <div className="text-center py-12">
        <h1 className="font-display text-2xl font-bold">My Salary</h1>
        <p className="text-muted-foreground mt-2">Your account is not linked to a staff record.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalPaid = enrichedRecords.filter(r => r.status === 'paid').reduce((acc, r) => acc + r._displayNet, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">My Salary</h1>
          <p className="mt-1 text-sm text-muted-foreground">View your salary and payment history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[60px] text-center">{selectedYear}</span>
          <Button variant="outline" size="icon" onClick={() => setSelectedYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Base Salary</p>
          <p className="text-2xl font-bold">₹{staffMember.salary.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Paid ({selectedYear})</p>
          <p className="text-2xl font-bold text-success">₹{totalPaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Payroll Records */}
      <div className="rounded-xl border bg-card divide-y divide-border">
        {enrichedRecords.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No payroll records for {selectedYear}
          </div>
        ) : (
          enrichedRecords.map((record) => (
            <div key={record.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{record.month} {record.year}</p>
                  <p className="text-sm text-muted-foreground">
                    Base: ₹{record.base_salary.toLocaleString()}
                    {record._absentDays > 0 ? ` • ${record._absentDays} absent (−₹${record._absenceDeduction.toLocaleString()})` : ''}
                    {record.bonus ? ` • +₹${record.bonus}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">₹{record._displayNet.toLocaleString()}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', getStatusColor(record.status))}>
                  {record.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
